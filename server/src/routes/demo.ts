import type { FastifyPluginAsync } from 'fastify';
import { pool, withTransaction } from '../db/pool.js';
import { seedDatabase } from '../db/seed.js';
import { processOperation } from '../services/applyEdit.js';
import { eventBroker } from '../services/events.js';

export const demoRoutes: FastifyPluginAsync = async (fastify) => {
  // Liveness & Database Healthcheck
  fastify.get('/health', async (request, reply) => {
    try {
      await pool.query('SELECT 1');
      return reply.send({ status: 'ok', service: 'campussync-backend', timestamp: new Date().toISOString() });
    } catch (err: any) {
      return reply.status(503).send({ status: 'unhealthy', error: err.message });
    }
  });

  // Reset Demo Data (FR-13.6, NFR-14)
  fastify.post('/demo/reset', async (request, reply) => {
    if (process.env.DEMO_MODE !== 'true') {
      return reply.status(403).send({ error: 'Demo endpoints are disabled in production mode' });
    }

    try {
      await seedDatabase(true);

      const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
      const latestCursor = parseInt(cursorRes.rows[0].max_cursor, 10);
      eventBroker.broadcast('sync_event', { cursor: latestCursor, reset: true });

      return reply.send({ success: true, message: 'Database reset to clean seeded state' });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to reset demo data', details: err.message });
    }
  });

  // Inject Remote Edit from Another Campus (FR-13.5)
  // E.g. simulates Islamabad Admin editing a Lahore student's address concurrently
  fastify.post('/demo/inject-edit', async (request, reply) => {
    if (process.env.DEMO_MODE !== 'true') {
      return reply.status(403).send({ error: 'Demo endpoints are disabled in production mode' });
    }

    const { studentId, field, newValue } = (request.body as any) || {};

    const targetStudentId = studentId || 's0000000-0000-0000-0000-000000000001';
    const targetField = field || 'address';
    const targetValue = newValue || 'Plot 99, Blue Area, Islamabad (Injected via Remote Admin)';

    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [targetStudentId]);
    if (studentRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Target student not found' });
    }

    const student = studentRes.rows[0];
    const fieldVersions = typeof student.field_versions === 'string'
      ? JSON.parse(student.field_versions)
      : student.field_versions;
    const currentFieldVersion = fieldVersions[targetField] || 1;

    const remoteActor = {
      id: 'c0000000-0000-0000-0000-000000000003',
      name: 'Dr. Tariq (Islamabad)',
      email: 'faculty.isb@campussync.local',
      role: 'admin' as const,
      campus: 'Islamabad' as const,
    };

    const opId = 'remote-' + Math.random().toString(36).substring(2, 10);

    const result = await withTransaction(async (client) => {
      return processOperation(client, {
        opId,
        studentId: targetStudentId,
        field: targetField,
        newValue: targetValue,
        baseVersion: currentFieldVersion,
        deviceId: 'Device B (Islamabad Branch)',
        type: 'edit',
        actor: remoteActor,
      });
    });

    const cursorRes = await pool.query('SELECT COALESCE(MAX(id), 0) as max_cursor FROM history');
    const latestCursor = parseInt(cursorRes.rows[0].max_cursor, 10);
    eventBroker.broadcast('sync_event', { cursor: latestCursor });

    return reply.send({ success: true, result, injectedBy: remoteActor.name });
  });
};
