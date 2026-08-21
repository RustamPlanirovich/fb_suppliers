import { query } from '../../utils/db.js';

export class ImportRepository {
  async create({ adminId, filename, target, rowsTotal }) {
    const { rows } = await query(
      `INSERT INTO import_jobs (admin_id, filename, target, rows_total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [adminId, filename, target, rowsTotal],
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM import_jobs WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async saveMapping(id, mapping) {
    const { rows } = await query(
      'UPDATE import_jobs SET mapping = $2 WHERE id = $1 RETURNING *',
      [id, JSON.stringify(mapping)],
    );
    return rows[0] ?? null;
  }

  async finish(id, { status, created, updated, skipped, error }) {
    const { rows } = await query(
      `UPDATE import_jobs SET status = $2, rows_created = $3, rows_updated = $4,
              rows_skipped = $5, error = $6, applied_at = now()
       WHERE id = $1 RETURNING *`,
      [id, status, created ?? 0, updated ?? 0, skipped ?? 0, error ?? null],
    );
    return rows[0] ?? null;
  }

  async list(limit) {
    const { rows } = await query(
      `SELECT j.*, a.name AS admin_name FROM import_jobs j
       LEFT JOIN admins a ON a.id = j.admin_id ORDER BY j.created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
}
