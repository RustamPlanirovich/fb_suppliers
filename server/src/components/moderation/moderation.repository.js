import { query } from '../../utils/db.js';
import { SqlBuilder } from '../../utils/sql.js';
import { QUEUES } from './moderation.queues.js';

export class ModerationRepository {
  async list(queueName, filters, paging) {
    const queue = QUEUES[queueName];
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.status, 'r.status = ?')
      .whereIf(filters.supplierId, 'r.supplier_id = ?')
      .whereIf(filters.userId, 'r.user_id = ?');
    if (queueName === 'submissions') builder.whereIf(filters.type, 'r.type = ?');
    if (queueName === 'complaints') builder.whereIf(filters.reason, 'r.reason = ?');
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT ${queue.select}, s.name AS supplier_name, u.telegram_id, u.username,
              a.name AS resolved_by_name, count(*) OVER () AS total_count
       FROM ${queue.table} r
       LEFT JOIN suppliers s ON s.id = r.supplier_id
       LEFT JOIN bot_users u ON u.id = r.user_id
       LEFT JOIN admins a ON a.id = r.resolved_by
       ${builder.clause}
       ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async findById(queueName, id) {
    const queue = QUEUES[queueName];
    const { rows } = await query(`SELECT * FROM ${queue.table} WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async resolve(queueName, id, { status, resolution, adminId }) {
    const queue = QUEUES[queueName];
    const hasResolution = queue.select.includes('r.resolution');
    const { rows } = await query(
      `UPDATE ${queue.table} SET status = $2, resolved_by = $3, resolved_at = now()
       ${hasResolution ? ', resolution = $4' : ''}
       WHERE id = $1 RETURNING *`,
      hasResolution ? [id, status, adminId, resolution ?? null] : [id, status, adminId],
    );
    return rows[0] ?? null;
  }

  async counts() {
    const { rows } = await query(
      `SELECT 'reviews' AS queue, count(*)::int AS count FROM reviews WHERE status = 'pending'
       UNION ALL
       SELECT 'complaints', count(*)::int FROM complaints WHERE status IN ('new', 'in_progress')
       UNION ALL
       SELECT 'deals', count(*)::int FROM deal_confirmations WHERE status = 'pending'
       UNION ALL
       SELECT 'submissions', count(*)::int FROM submissions WHERE status = 'new'`,
    );
    return Object.fromEntries(rows.map((row) => [row.queue, row.count]));
  }

  async createReview(data) {
    const { rows } = await query(
      `INSERT INTO reviews (supplier_id, user_id, rating, score_response, score_delivery,
                            score_accuracy, text)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.supplierId, data.userId, data.rating ?? null, data.scoreResponse ?? null,
        data.scoreDelivery ?? null, data.scoreAccuracy ?? null, data.text ?? null],
    );
    return rows[0];
  }

  async createComplaint(data) {
    const { rows } = await query(
      `INSERT INTO complaints (supplier_id, offer_id, user_id, reason, text)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.supplierId, data.offerId ?? null, data.userId, data.reason, data.text ?? null],
    );
    return rows[0];
  }

  async createDeal(data) {
    const { rows } = await query(
      `INSERT INTO deal_confirmations (supplier_id, offer_id, user_id, price, qty, is_problem)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.supplierId, data.offerId ?? null, data.userId, data.price ?? null,
        data.qty ?? 1, data.isProblem ?? false],
    );
    return rows[0];
  }

  async createSubmission(data) {
    const { rows } = await query(
      `INSERT INTO submissions (user_id, type, supplier_id, offer_id, variant_id, payload, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.userId, data.type, data.supplierId ?? null, data.offerId ?? null,
        data.variantId ?? null, JSON.stringify(data.payload ?? {}), data.evidence ?? null],
    );
    return rows[0];
  }
}
