import { query } from '../../utils/db.js';

export class PromoCodesRepository {
  async all() {
    const { rows } = await query(
      `SELECT pc.*, p.code AS plan_code FROM promo_codes pc
       LEFT JOIN plans p ON p.id = pc.plan_id ORDER BY pc.created_at DESC`,
    );
    return rows;
  }

  async findUsable(code) {
    const { rows } = await query(
      `SELECT * FROM promo_codes
       WHERE upper(code) = upper($1) AND is_active
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [code],
    );
    return rows[0] ?? null;
  }

  async create(data) {
    const { rows } = await query(
      `INSERT INTO promo_codes (code, plan_id, discount_pct, bonus_days, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.code.toUpperCase(), data.planId ?? null, data.discountPct ?? 0,
        data.bonusDays ?? 0, data.maxUses ?? null, data.expiresAt ?? null],
    );
    return rows[0];
  }

  async markUsed(id) {
    await query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [id]);
  }

  async setActive(id, isActive) {
    const { rows } = await query(
      'UPDATE promo_codes SET is_active = $2 WHERE id = $1 RETURNING *', [id, isActive]);
    return rows[0] ?? null;
  }
}
