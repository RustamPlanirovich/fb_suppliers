import { query } from '../../utils/db.js';
import { SqlBuilder } from '../../utils/sql.js';

export class SubscriptionsRepository {
  async activeForUser(userId) {
    const { rows } = await query(
      `SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.features
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active' AND s.ends_at > now()
       ORDER BY s.ends_at DESC LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async grant({ userId, planId, days, source, createdBy }) {
    const { rows } = await query(
      `INSERT INTO subscriptions (user_id, plan_id, ends_at, source, created_by)
       VALUES ($1, $2, now() + make_interval(days => $3), $4, $5) RETURNING *`,
      [userId, planId, days, source ?? 'manual', createdBy ?? null],
    );
    return rows[0];
  }

  async extend(id, days) {
    const { rows } = await query(
      `UPDATE subscriptions SET ends_at = greatest(ends_at, now()) + make_interval(days => $2),
                                status = 'active'
       WHERE id = $1 RETURNING *`,
      [id, days],
    );
    return rows[0] ?? null;
  }

  async cancel(id) {
    const { rows } = await query(
      "UPDATE subscriptions SET status = 'cancelled' WHERE id = $1 RETURNING *", [id]);
    return rows[0] ?? null;
  }

  async expireOutdated() {
    const { rowCount } = await query(
      "UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND ends_at <= now()");
    return rowCount;
  }

  async history(userId) {
    const { rows } = await query(
      `SELECT s.*, p.code AS plan_code, p.name AS plan_name FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async listPayments(filters, paging) {
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.userId, 'pay.user_id = ?')
      .whereIf(filters.status, 'pay.status = ?')
      .whereIf(filters.from, 'pay.created_at >= ?');
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT pay.*, u.telegram_id, u.username, p.code AS plan_code,
              count(*) OVER () AS total_count
       FROM payments pay
       LEFT JOIN bot_users u ON u.id = pay.user_id
       LEFT JOIN plans p ON p.id = pay.plan_id
       ${builder.clause} ORDER BY pay.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async createPayment(data) {
    const { rows } = await query(
      `INSERT INTO payments (user_id, plan_id, subscription_id, promo_code_id, amount, currency,
                             status, provider, external_id, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               CASE WHEN $7 = 'paid' THEN now() ELSE NULL END)
       RETURNING *`,
      [data.userId, data.planId ?? null, data.subscriptionId ?? null, data.promoCodeId ?? null,
        data.amount, data.currency ?? 'RUB', data.status ?? 'pending',
        data.provider ?? 'manual', data.externalId ?? null],
    );
    return rows[0];
  }
}
