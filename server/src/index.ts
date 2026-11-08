import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { authRoutes } from './routes/auth.js';
import { syncRoutes } from './routes/sync.js';
import { conflictRoutes } from './routes/conflicts.js';
import { studentRoutes } from './routes/students.js';
import { adminRoutes } from './routes/admin.js';
import { demoRoutes } from './routes/demo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function main() {
  try {
    // 1. Database Migrations & Initial Seed
    try {
      await runMigrations();
      await seedDatabase(false);
    } catch (dbErr) {
      console.warn('Database connection warning (will retry on incoming requests):', dbErr);
    }

    // 2. Middleware Plugins
    await fastify.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    await fastify.register(cookie, {
      secret: process.env.COOKIE_SECRET || 'campussync-cookie-secret-key-32chars',
    });

    // 3. Register API Routes
    await fastify.register(authRoutes);
    await fastify.register(syncRoutes);
    await fastify.register(conflictRoutes);
    await fastify.register(studentRoutes);
    await fastify.register(adminRoutes);
    await fastify.register(demoRoutes);

    // 4. Serve Single-Container Built Frontend if web/dist exists
    const webDistPath = path.resolve(__dirname, '../../web/dist');
    if (fs.existsSync(webDistPath)) {
      console.log(`Serving web assets from ${webDistPath}`);
      await fastify.register(fastifyStatic, {
        root: webDistPath,
        prefix: '/',
      });

      fastify.setNotFoundHandler((req, reply) => {
        // SPA Fallback: send index.html for unknown routes if not an API request
        if (!req.raw.url?.startsWith('/auth') &&
            !req.raw.url?.startsWith('/sync') &&
            !req.raw.url?.startsWith('/conflicts') &&
            !req.raw.url?.startsWith('/students') &&
            !req.raw.url?.startsWith('/admin') &&
            !req.raw.url?.startsWith('/demo') &&
            !req.raw.url?.startsWith('/events') &&
            !req.raw.url?.startsWith('/health')) {
          return reply.sendFile('index.html');
        }
        return reply.status(404).send({ error: 'Endpoint not found' });
      });
    }

    // 5. Start Listening
    const port = parseInt(process.env.PORT || '3050', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`CampusSync backend listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
