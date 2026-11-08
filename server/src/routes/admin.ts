import type { FastifyPluginAsync } from 'fastify';
import { authenticateUser } from '../middleware/auth.js';
import { runIntegritySuite } from '../services/integrity.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/integrity', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins may run data integrity verification' });
    }

    try {
      const suiteResult = await runIntegritySuite();
      return reply.send(suiteResult);
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Integrity suite execution failed',
        details: err.message,
      });
    }
  });
};
