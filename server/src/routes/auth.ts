import type { FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool.js';
import type { CurrentUser } from '@campussync/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'campussync-hackathon-secret-key-2026';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'campussync-salt').digest('hex');
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }

    const hashed = hashPassword(password);
    const userRes = await pool.query(
      'SELECT id, name, email, role, campus, student_id FROM users WHERE email = $1 AND password_hash = $2',
      [email.toLowerCase().trim(), hashed]
    );

    if (userRes.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user: CurrentUser = userRes.rows[0];
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    reply.setCookie('campussync_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ user, token });
  });

  fastify.post('/auth/logout', async (request, reply) => {
    reply.clearCookie('campussync_token', { path: '/' });
    return reply.send({ success: true });
  });

  fastify.get('/auth/me', async (request, reply) => {
    const token = request.cookies.campussync_token ||
      (request.headers.authorization?.replace('Bearer ', ''));

    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as CurrentUser;
      return reply.send({ user: decoded });
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
  });
};
