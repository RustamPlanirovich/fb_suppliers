import { query } from '../../utils/db.js';

// Избранное, watchlist и позиции реселлера — личные данные пользователя бота.
export class FavoritesRepository {
  async add(userId, supplierId) {
    await query(
      'INSERT INTO favorites (user_id, supplier_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, supplierId],
    );
  }

  async remove(userId, supplierId) {
    const { rowCount } = await query(
      'DELETE FROM favorites WHERE user_id = $1 AND supplier_id = $2', [userId, supplierId]);
    return rowCount > 0;
  }

  async has(userId, supplierId) {
    const { rows } = await query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND supplier_id = $2', [userId, supplierId]);
    return rows.length > 0;
  }

  async count(userId) {
    const { rows } = await query(
      'SELECT count(*)::int AS total FROM favorites WHERE user_id = $1', [userId]);
    return rows[0].total;
  }

  async list(userId, limit) {
    const { rows } = await query(
      `SELECT s.id, s.name, s.status, s.telegram, s.website, s.score_reliability,
              s.confirmed_deals_30d, s.offers_count
       FROM favorites f JOIN suppliers s ON s.id = f.supplier_id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }

  async addWatch(userId, variantId, note) {
    const { rows } = await query(
      `INSERT INTO watchlist (user_id, variant_id, note) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, variant_id) DO UPDATE SET note = excluded.note RETURNING *`,
      [userId, variantId, note ?? null],
    );
    return rows[0];
  }

  async removeWatch(userId, variantId) {
    const { rowCount } = await query(
      'DELETE FROM watchlist WHERE user_id = $1 AND variant_id = $2', [userId, variantId]);
    return rowCount > 0;
  }

  async watchCount(userId) {
    const { rows } = await query(
      'SELECT count(*)::int AS total FROM watchlist WHERE user_id = $1', [userId]);
    return rows[0].total;
  }

  async watchList(userId, limit) {
    const { rows } = await query(
      `SELECT w.variant_id, w.note, v.name AS variant_name, p.name AS product_name,
              v.buy_min, v.sell_avg, v.margin_pct, v.trend_7d_pct, v.suppliers_count
       FROM watchlist w
       JOIN product_variants v ON v.id = w.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE w.user_id = $1 ORDER BY w.created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }
}
