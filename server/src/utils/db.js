// Единственный pg.Pool на процесс. В компонентах использовать только query() и withTransaction().
// ТОЛЬКО параметризованные запросы: query('SELECT * FROM users WHERE id = $1', [id]).
import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

export const pool = new pg.Pool(config.db);

pool.on('error', (err) => logger.error('Ошибка pg pool', { err: err.message }));

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
