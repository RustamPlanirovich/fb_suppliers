import { query } from '../../utils/db.js';

export class AlertsRepository {
  async create({ userId, variantId, type, threshold }) {
    const { rows } = await query(
      `INSERT INTO alerts (user_id, variant_id, type, threshold)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, variantId ?? null, type, threshold],
    );
    return rows[0];
  }

  async listForUser(userId) {
    const { rows } = await query(
      `SELECT a.*, p.name AS product_name, v.name AS variant_name
       FROM alerts a
       LEFT JOIN product_variants v ON v.id = a.variant_id
       LEFT JOIN products p ON p.id = v.product_id
       WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async countForUser(userId) {
    const { rows } = await query(
      'SELECT count(*)::int AS total FROM alerts WHERE user_id = $1 AND is_active', [userId]);
    return rows[0].total;
  }

  async remove(userId, id) {
    const { rowCount } = await query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2', [id, userId]);
    return rowCount > 0;
  }

  // Кандидаты на срабатывание: активные алерты с текущими показателями варианта.
  async candidates(limit) {
    const { rows } = await query(
      `SELECT a.id, a.user_id, a.variant_id, a.type, a.threshold, a.last_fired_at,
              u.telegram_id, p.name AS product_name, v.name AS variant_name,
              v.buy_min, v.sell_avg, v.margin_pct, v.trend_7d_pct, v.suppliers_count
       FROM alerts a
       JOIN bot_users u ON u.id = a.user_id AND NOT u.is_blocked
       LEFT JOIN product_variants v ON v.id = a.variant_id
       LEFT JOIN products p ON p.id = v.product_id
       WHERE a.is_active
         AND (a.last_fired_at IS NULL OR a.last_fired_at < now() - interval '12 hours')
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async registerHit(alertId, value, message) {
    await query(
      `INSERT INTO alert_hits (alert_id, value, message) VALUES ($1, $2, $3)`,
      [alertId, value, message]);
    await query(
      'UPDATE alerts SET last_fired_at = now(), fired_count = fired_count + 1 WHERE id = $1',
      [alertId]);
  }

  async stats() {
    const { rows } = await query(
      `SELECT type, count(*)::int AS total, sum(fired_count)::int AS fired
       FROM alerts GROUP BY type ORDER BY total DESC`);
    return rows;
  }
}
