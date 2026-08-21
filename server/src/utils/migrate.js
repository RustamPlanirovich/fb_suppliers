// Прогон миграций: npm run migrate
// Применяет новые .sql из /migrations по порядку, каждый в транзакции. Учёт — таблица _migrations.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db.js';
import { logger } from './logger.js';

const dir = path.resolve(process.cwd(), 'migrations');

await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

const { rows } = await pool.query('SELECT name FROM _migrations');
const applied = new Set(rows.map((row) => row.name));
const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(path.join(dir, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    logger.info(`Применена миграция: ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`Миграция упала: ${file}`, { err: err.message });
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}

await pool.end();
