import { query } from '../../utils/db.js';

export class TagsRepository {
  async all() {
    const { rows } = await query(
      `SELECT t.*, (SELECT count(*)::int FROM supplier_tags st WHERE st.tag_id = t.id) AS usage_count
       FROM tags t ORDER BY t.name`,
    );
    return rows;
  }

  async create({ name, slug, color }) {
    const { rows } = await query(
      'INSERT INTO tags (name, slug, color) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, color ?? null],
    );
    return rows[0];
  }

  async update(id, { name, color }) {
    const { rows } = await query(
      'UPDATE tags SET name = coalesce($2, name), color = coalesce($3, color) WHERE id = $1 RETURNING *',
      [id, name ?? null, color ?? null],
    );
    return rows[0] ?? null;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM tags WHERE id = $1', [id]);
    return rowCount > 0;
  }
}
