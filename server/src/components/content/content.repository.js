import { query } from '../../utils/db.js';

export class ContentRepository {
  async all() {
    const { rows } = await query('SELECT * FROM content_blocks ORDER BY key');
    return rows;
  }

  async activeMap() {
    const { rows } = await query(
      'SELECT key, title, body, media_url, type FROM content_blocks WHERE is_active');
    return Object.fromEntries(rows.map((row) => [row.key, row]));
  }

  async upsert({ key, type, title, body, mediaUrl, isActive, updatedBy }) {
    const { rows } = await query(
      `INSERT INTO content_blocks (key, type, title, body, media_url, is_active, updated_by)
       VALUES ($1, coalesce($2, 'text'), $3, coalesce($4, ''), $5, coalesce($6, TRUE), $7)
       ON CONFLICT (key) DO UPDATE SET
         type = coalesce(excluded.type, content_blocks.type),
         title = excluded.title, body = excluded.body, media_url = excluded.media_url,
         is_active = excluded.is_active, updated_by = excluded.updated_by, updated_at = now()
       RETURNING *`,
      [key, type ?? null, title ?? null, body ?? null, mediaUrl ?? null, isActive, updatedBy],
    );
    return rows[0];
  }

  async remove(key) {
    const { rowCount } = await query('DELETE FROM content_blocks WHERE key = $1', [key]);
    return rowCount > 0;
  }

  async faq(activeOnly = false) {
    const { rows } = await query(
      `SELECT * FROM faq_entries ${activeOnly ? 'WHERE is_active' : ''} ORDER BY sort_order, id`);
    return rows;
  }

  async createFaq({ question, answer, sortOrder }) {
    const { rows } = await query(
      'INSERT INTO faq_entries (question, answer, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [question, answer, sortOrder ?? 0],
    );
    return rows[0];
  }

  async updateFaq(id, { question, answer, sortOrder, isActive }) {
    const { rows } = await query(
      `UPDATE faq_entries SET
         question = coalesce($2, question), answer = coalesce($3, answer),
         sort_order = coalesce($4, sort_order), is_active = coalesce($5, is_active),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, question ?? null, answer ?? null, sortOrder ?? null, isActive ?? null],
    );
    return rows[0] ?? null;
  }

  async removeFaq(id) {
    const { rowCount } = await query('DELETE FROM faq_entries WHERE id = $1', [id]);
    return rowCount > 0;
  }
}
