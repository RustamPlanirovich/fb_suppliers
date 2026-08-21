import { query } from '../../utils/db.js';

// Мини-CRM реселлера: свои позиции, закупка/продажа/количество/прибыль.
export class PositionsRepository {
  async list(userId, limit) {
    const { rows } = await query(
      `SELECT rp.*, p.name AS product_name, v.name AS variant_name, s.name AS supplier_name
       FROM reseller_positions rp
       LEFT JOIN product_variants v ON v.id = rp.variant_id
       LEFT JOIN products p ON p.id = v.product_id
       LEFT JOIN suppliers s ON s.id = rp.supplier_id
       WHERE rp.user_id = $1 AND rp.status <> 'cancelled'
       ORDER BY rp.created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }

  async create(userId, data) {
    const { rows } = await query(
      `INSERT INTO reseller_positions (user_id, variant_id, supplier_id, title, buy_price,
                                       sell_price, qty, commission_pct, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, data.variantId ?? null, data.supplierId ?? null, data.title,
        data.buyPrice ?? 0, data.sellPrice ?? 0, data.qty ?? 1,
        data.commissionPct ?? 0, data.note ?? null],
    );
    return rows[0];
  }

  async setStatus(userId, id, status) {
    const { rows } = await query(
      `UPDATE reseller_positions SET status = $3, updated_at = now()
       WHERE id = $2 AND user_id = $1 RETURNING *`,
      [userId, id, status],
    );
    return rows[0] ?? null;
  }

  // Сводка кабинета: сколько вложено и сколько заработано.
  async summary(userId) {
    const { rows } = await query(
      `SELECT
         count(*)::int AS positions,
         coalesce(sum(buy_price * qty), 0) AS invested,
         coalesce(sum((sell_price - sell_price * commission_pct / 100 - buy_price) * qty), 0)
           AS profit
       FROM reseller_positions WHERE user_id = $1 AND status = 'sold'`,
      [userId],
    );
    return rows[0];
  }
}
