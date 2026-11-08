import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import type { CurrentUser } from '@campussync/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'campussync-hackathon-secret-key-2026';

declare module 'fastify' {
  interface FastifyRequest {
    user?: CurrentUser;
  }
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.campussync_token ||
    (request.headers.authorization?.replace('Bearer ', ''));

  if (!token) {
    // If running in DEMO_MODE, provide a default Admin user so testing is painless
    if (process.env.DEMO_MODE === 'true') {
      request.user = {
        id: 'c0000000-0000-0000-0000-000000000001',
        name: 'Central Admin',
        email: 'admin@campussync.local',
        role: 'admin',
      };
      return;
    }
    return reply.status(401).send({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CurrentUser;
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
