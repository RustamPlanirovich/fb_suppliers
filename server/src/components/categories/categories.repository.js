import { query } from '../../utils/db.js';

export class CategoriesRepository {
  async all() {
    const { rows } = await query(
      `SELECT c.*, (SELECT count(*)::int FROM suppliers s WHERE s.category_id = c.id) AS suppliers_count
       FROM categories c ORDER BY c.path, c.sort_order, c.name`,
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM categories WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async create({ parentId, name, slug, sortOrder, funpayUrl, path, depth }) {
    const { rows } = await query(
      `INSERT INTO categories (parent_id, name, slug, sort_order, funpay_url, path, depth)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [parentId ?? null, name, slug, sortOrder ?? 0, funpayUrl ?? null, path, depth],
    );
    return rows[0];
  }

  async update(id, { name, sortOrder, isActive, funpayUrl }) {
    const { rows } = await query(
      `UPDATE categories SET
         name = coalesce($2, name),
         sort_order = coalesce($3, sort_order),
         is_active = coalesce($4, is_active),
         funpay_url = coalesce($5, funpay_url),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, name ?? null, sortOrder ?? null, isActive ?? null, funpayUrl ?? null],
    );
    return rows[0] ?? null;
  }

  // Перенос ветки: пересобираем path и depth у всей поддеревни.
  async move(id, newParentId, newPath, newDepth, oldPath) {
    await query(
      `UPDATE categories SET parent_id = $2, path = $3, depth = $4, updated_at = now()
       WHERE id = $1`,
      [id, newParentId, newPath, newDepth],
    );
    await query(
      `UPDATE categories SET
         path = $2 || substring(path from length($3) + 1),
         depth = depth + ($4 - $5)
       WHERE path LIKE $3 || '%' AND id <> $1`,
      [id, newPath, oldPath, newDepth, newDepth],
    );
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [id]);
    return rowCount > 0;
  }
}
