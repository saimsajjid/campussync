import type { FastifyPluginAsync } from 'fastify';
import { pool, withTransaction } from '../db/pool.js';
import { authenticateUser } from '../middleware/auth.js';
import { processOperation } from '../services/applyEdit.js';
import { eventBroker } from '../services/events.js';
import { safeJsonParse } from '../utils/json.js';
import type { ConflictItem } from '@campussync/shared';

export const conflictRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/conflicts', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;

    let sql = `
      SELECT c.*, s.full_name as "studentName", s.reg_no
      FROM conflicts c
      JOIN students s ON c.student_id = s.id
      WHERE c.status = 'open'
    `;
    const params: any[] = [];

    if (user.role === 'faculty' && user.campus) {
      sql += ' AND s.campus = $1';
      params.push(user.campus);
    } else if (user.role === 'student' && user.student_id) {
      sql += ' AND s.id = $1';
      params.push(user.student_id);
    }

    sql += ' ORDER BY c.created_at DESC';

    const res = await pool.query<ConflictItem>(sql, params);
    return reply.send({
      conflicts: res.rows.map((c) => ({
        ...c,
        serverValue: safeJsonParse(c.serverValue),
        incomingValue: safeJsonParse(c.incomingValue),
      })),
    });
  });

  fastify.post('/conflicts/:id/resolve', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { choice, customValue, expectedServerVersion } = request.body as {
      choice: 'mine' | 'theirs' | 'custom';
      customValue?: any;
      expectedServerVersion: number;
    };

    const conflictRes = await pool.query('SELECT * FROM conflicts WHERE id = $1', [id]);
    if (conflictRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Conflict item not found' });
    }

    const conflict = conflictRes.rows[0];
    if (conflict.status !== 'open') {
      return reply.status(400).send({ error: 'Conflict is already resolved' });
    }

    // Role check: Only admin or the conflicting actor may resolve (FR-8.5)
    if (user.role !== 'admin' && user.name !== conflict.actor_id) {
      return reply.status(403).send({ error: 'Only admins or the originator may resolve this conflict' });
    }

    // Check if record was changed underneath (FR-8.4)
    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [conflict.student_id]);
    if (studentRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Student record no longer exists' });
    }

    const student = studentRes.rows[0];
    const fieldVersions = safeJsonParse(student.field_versions) || {};
    const currentFieldVersion = fieldVersions[conflict.field] || 1;

    if (expectedServerVersion !== undefined && expectedServerVersion !== currentFieldVersion) {
      return reply.status(409).send({
        error: 'Stale resolution: The server record has changed since you inspected it.',
        currentServerVersion: currentFieldVersion,
        currentServerValue: student[conflict.field],
      });
    }

    let resolvedValue: any;
    if (choice === 'mine') {
      resolvedValue = safeJsonParse(conflict.incoming_value);
    } else if (choice === 'theirs') {
      resolvedValue = student[conflict.field];
    } else {
      resolvedValue = customValue;
    }

    const opId = 'res-' + Math.random().toString(36).substring(2, 10);

    const result = await withTransaction(async (client) => {
      return processOperation(client, {
        opId,
        studentId: conflict.student_id,
        field: conflict.field,
        newValue: resolvedValue,
        baseVersion: currentFieldVersion,
        deviceId: 'resolver-session',
        type: 'resolve',
        actor: user,
      });
    });

    // Mark conflict resolved
    await pool.query(
      `UPDATE conflicts SET
        status = 'resolved',
        resolved_by = $1,
        resolved_at = NOW(),
        resolution = $2
      WHERE id = $3`,
      [user.name, `Choice: ${choice}`, id]
    );

    // Broadcast SSE
    const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
    eventBroker.broadcast('sync_event', { cursor: parseInt(cursorRes.rows[0].max_cursor, 10) });

    return reply.send({ success: true, result });
  });
};
