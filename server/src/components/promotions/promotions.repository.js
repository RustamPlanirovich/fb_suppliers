import { query } from '../../utils/db.js';

export class PromotionsRepository {
  async placements() {
    const { rows } = await query('SELECT * FROM promo_placements ORDER BY slot, price');
    return rows;
  }

  async findPlacement(id) {
    const { rows } = await query('SELECT * FROM promo_placements WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async upsertPlacement(data) {
    const { rows } = await query(
      `INSERT INTO promo_placements (code, name, description, slot, weight, days, price, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, coalesce($8, TRUE))
       ON CONFLICT (code) DO UPDATE SET
         name = excluded.name, description = excluded.description, slot = excluded.slot,
         weight = excluded.weight, days = excluded.days, price = excluded.price,
         is_active = excluded.is_active
       RETURNING *`,
      [data.code, data.name, data.description ?? null, data.slot ?? 'top', data.weight ?? 100,
        data.days ?? 30, data.price ?? 0, data.isActive],
    );
    return rows[0];
  }

  async list(filters, paging) {
    const { rows } = await query(
      `SELECT p.*, s.name AS supplier_name, c.name AS category_name, pl.name AS placement_name,
              count(*) OVER () AS total_count
       FROM promotions p
       JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN promo_placements pl ON pl.id = p.placement_id
       WHERE ($1::boolean IS NULL OR (p.is_active AND p.ends_at > now()) = $1)
         AND ($2::bigint IS NULL OR p.supplier_id = $2)
       ORDER BY p.ends_at DESC LIMIT $3 OFFSET $4`,
      [filters.activeOnly ?? null, filters.supplierId ?? null, paging.limit, paging.offset],
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async create(data) {
    const { rows } = await query(
      `INSERT INTO promotions (supplier_id, placement_id, category_id, slot, weight, discount_pct,
                               amount_paid, currency, ends_at, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(days => $9), $10, $11)
       RETURNING *`,
      [data.supplierId, data.placementId ?? null, data.categoryId ?? null, data.slot ?? 'top',
        data.weight ?? 100, data.discountPct ?? 0, data.amountPaid ?? 0, data.currency ?? 'RUB',
        data.days ?? 30, data.note ?? null, data.createdBy ?? null],
    );
    return rows[0];
  }

  async stop(id) {
    const { rows } = await query(
      'UPDATE promotions SET is_active = FALSE WHERE id = $1 RETURNING *', [id]);
    return rows[0] ?? null;
  }
}
