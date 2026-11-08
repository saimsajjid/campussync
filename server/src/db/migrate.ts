import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('Running database migrations...');
  const possiblePaths = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '../src/db/schema.sql'),
    path.join(__dirname, '../../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'dist/db/schema.sql'),
  ];

  let schemaPath = possiblePaths.find((p) => fs.existsSync(p));
  if (!schemaPath) {
    throw new Error(`schema.sql not found in any of: ${possiblePaths.join(', ')}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migrations executed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
