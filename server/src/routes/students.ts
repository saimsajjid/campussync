import type { FastifyPluginAsync } from 'fastify';
import { pool, withTransaction } from '../db/pool.js';
import { authenticateUser } from '../middleware/auth.js';
import { processOperation } from '../services/applyEdit.js';
import { eventBroker } from '../services/events.js';

export const studentRoutes: FastifyPluginAsync = async (fastify) => {
  // Get history timeline for a student
  fastify.get('/students/:id/history', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    // Ownership & campus checks
    if (user.role === 'student' && user.student_id !== id) {
      return reply.status(403).send({ error: 'Students may only view their own history' });
    }

    if (user.role === 'faculty' && user.campus) {
      const sCheck = await pool.query('SELECT campus FROM students WHERE id = $1', [id]);
      if (sCheck.rows.length === 0 || sCheck.rows[0].campus !== user.campus) {
        return reply.status(403).send({ error: 'Faculty may only view records from their own campus' });
      }
    }

    const historyRes = await pool.query(
      `SELECT h.*, s.full_name as "studentName", s.reg_no
       FROM history h
       JOIN students s ON h.student_id = s.id
       WHERE h.student_id = $1
       ORDER BY h.id DESC`,
      [id]
    );

    return reply.send({
      history: historyRes.rows.map((r) => ({
        id: parseInt(r.id, 10),
        studentId: r.student_id,
        studentName: r.studentName,
        reg_no: r.reg_no,
        field: r.field,
        oldValue: typeof r.old_value === 'string' ? JSON.parse(r.old_value) : r.old_value,
        newValue: typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value,
        fieldVersionAfter: r.field_version_after,
        type: r.type,
        actorName: r.actor_id,
        actorRole: r.actor_role,
        actorCampus: r.actor_campus,
        device: r.device_id,
        opId: r.op_id,
        createdAt: r.created_at,
      })),
    });
  });

  // Admin Restore to Historical Version (FR-10.1, FR-10.2)
  fastify.post('/students/:id/restore', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { field, targetValue } = request.body as { field: string; targetValue: any };

    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can restore previous versions' });
    }

    if (!field || targetValue === undefined) {
      return reply.status(400).send({ error: 'field and targetValue are required' });
    }

    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Student record not found' });
    }

    const student = studentRes.rows[0];
    const fieldVersions = typeof student.field_versions === 'string'
      ? JSON.parse(student.field_versions)
      : student.field_versions;
    const currentFieldVersion = fieldVersions[field] || 1;

    const opId = 'restore-' + Math.random().toString(36).substring(2, 10);

    const result = await withTransaction(async (client) => {
      return processOperation(client, {
        opId,
        studentId: id,
        field,
        newValue: targetValue,
        baseVersion: currentFieldVersion,
        deviceId: 'admin-restore-portal',
        type: 'restore',
        actor: user,
      });
    });

    const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
    eventBroker.broadcast('sync_event', { cursor: parseInt(cursorRes.rows[0].max_cursor, 10) });

    return reply.send({ success: true, result });
  });
};
