import type { FastifyPluginAsync } from 'fastify';
import { pool, withTransaction } from '../db/pool.js';
import { authenticateUser } from '../middleware/auth.js';
import { processOperation } from '../services/applyEdit.js';
import { eventBroker } from '../services/events.js';
import type {
  PushBatchRequest,
  PushBatchResponse,
  SnapshotResponse,
  PullResponse,
  OperationResult,
  StudentRecord,
  ConflictItem,
} from '@campussync/shared';

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  // Snapshot initial load
  fastify.get('/sync/snapshot', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;

    let queryText = 'SELECT * FROM students WHERE active = TRUE';
    const params: any[] = [];

    // Filter by campus if faculty
    if (user.role === 'faculty' && user.campus) {
      queryText += ' AND campus = $1';
      params.push(user.campus);
    } else if (user.role === 'student' && user.student_id) {
      queryText += ' AND id = $1';
      params.push(user.student_id);
    }

    queryText += ' ORDER BY full_name ASC';

    const studentsRes = await pool.query<StudentRecord>(queryText, params);

    // Get open conflicts
    let conflictQuery = `
      SELECT c.*, s.full_name as "studentName", s.reg_no
      FROM conflicts c
      JOIN students s ON c.student_id = s.id
      WHERE c.status = 'open'
    `;
    const conflictParams: any[] = [];
    if (user.role === 'faculty' && user.campus) {
      conflictQuery += ' AND s.campus = $1';
      conflictParams.push(user.campus);
    } else if (user.role === 'student' && user.student_id) {
      conflictQuery += ' AND s.id = $1';
      conflictParams.push(user.student_id);
    }

    const conflictsRes = await pool.query<ConflictItem>(conflictQuery, conflictParams);

    // Get max cursor from history
    const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
    const latestCursor = parseInt(cursorRes.rows[0].max_cursor, 10);

    const snapshot: SnapshotResponse = {
      students: studentsRes.rows.map((r) => ({
        ...r,
        field_versions: typeof r.field_versions === 'string' ? JSON.parse(r.field_versions) : r.field_versions,
      })),
      conflicts: conflictsRes.rows.map((c) => ({
        ...c,
        serverValue: typeof c.serverValue === 'string' ? JSON.parse(c.serverValue) : c.serverValue,
        incomingValue: typeof c.incomingValue === 'string' ? JSON.parse(c.incomingValue) : c.incomingValue,
      })),
      latestCursor,
    };

    return reply.send(snapshot);
  });

  // Batch Push Operations (FR-5.6, FR-5.8)
  fastify.post('/sync/push', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as PushBatchRequest;

    if (!body || !Array.isArray(body.operations)) {
      return reply.status(400).send({ error: 'Expected an operations array in request body' });
    }

    const results: OperationResult[] = [];

    // Process each operation within its own atomic transaction so a single bad op does not fail the batch
    for (const op of body.operations) {
      try {
        const opResult = await withTransaction(async (client) => {
          return processOperation(client, {
            opId: op.opId,
            studentId: op.studentId,
            field: op.field,
            newValue: op.newValue,
            baseVersion: op.baseVersion,
            deviceId: op.deviceId || 'device-unknown',
            type: op.type || 'edit',
            studentData: op.studentData,
            actor: user,
          });
        });
        results.push(opResult);
      } catch (err: any) {
        results.push({
          opId: op.opId,
          status: 'rejected',
          reason: `Internal execution error: ${err.message}`,
        });
      }
    }

    // Get latest cursor
    const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
    const latestCursor = parseInt(cursorRes.rows[0].max_cursor, 10);

    // Broadcast change notification via SSE
    eventBroker.broadcast('sync_event', { cursor: latestCursor });

    const responsePayload: PushBatchResponse = {
      results,
      latestCursor,
    };

    return reply.send(responsePayload);
  });

  // Pull Incremental Changes
  fastify.get('/sync/pull', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    const since = parseInt((request.query as any)?.since || '0', 10);

    let queryText = `
      SELECT h.*, s.full_name as "studentName", s.reg_no
      FROM history h
      JOIN students s ON h.student_id = s.id
      WHERE h.id > $1
    `;
    const params: any[] = [since];

    if (user.role === 'faculty' && user.campus) {
      queryText += ' AND s.campus = $2';
      params.push(user.campus);
    } else if (user.role === 'student' && user.student_id) {
      queryText += ' AND s.id = $2';
      params.push(user.student_id);
    }

    queryText += ' ORDER BY h.id ASC LIMIT 200';

    const historyRes = await pool.query(queryText, params);

    const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
    const latestCursor = parseInt(cursorRes.rows[0].max_cursor, 10);

    const responsePayload: PullResponse = {
      changes: historyRes.rows.map((r) => ({
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
      latestCursor,
    };

    return reply.send(responsePayload);
  });

  // Server-Sent Events (SSE) Stream
  fastify.get('/events', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    eventBroker.addClient(reply);

    // Send initial keep-alive ping
    reply.raw.write('event: connected\ndata: {"status":"connected"}\n\n');
  });
};
