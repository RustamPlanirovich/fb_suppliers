import { query } from '../../utils/db.js';
import { normalizePaging } from '../../utils/pagination.js';

export class BroadcastsRepository {
  async list(paging) {
    const { limit, offset } = normalizePaging(paging);
    const { rows } = await query(
      `SELECT b.*, a.name AS created_by_name, count(*) OVER () AS total_count
       FROM broadcasts b LEFT JOIN admins a ON a.id = b.created_by
       ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM broadcasts WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async create(data) {
    const { rows } = await query(
      `INSERT INTO broadcasts (title, body, media_url, buttons, segment, scheduled_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, coalesce($7, 'draft'), $8) RETURNING *`,
      [data.title, data.body, data.mediaUrl ?? null, JSON.stringify(data.buttons ?? []),
        JSON.stringify(data.segment ?? {}), data.scheduledAt ?? null, data.status, data.createdBy],
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await query(
      `UPDATE broadcasts SET
         title = coalesce($2, title), body = coalesce($3, body),
         media_url = coalesce($4, media_url), buttons = coalesce($5, buttons),
         segment = coalesce($6, segment), scheduled_at = $7, updated_at = now()
       WHERE id = $1 AND status IN ('draft', 'scheduled') RETURNING *`,
      [id, data.title ?? null, data.body ?? null, data.mediaUrl ?? null,
        data.buttons ? JSON.stringify(data.buttons) : null,
        data.segment ? JSON.stringify(data.segment) : null, data.scheduledAt ?? null],
    );
    return rows[0] ?? null;
  }

  async setStatus(id, status, patch = {}) {
    const { rows } = await query(
      `UPDATE broadcasts SET status = $2,
         total_count = coalesce($3, total_count),
         started_at = CASE WHEN $2 = 'sending' THEN now() ELSE started_at END,
         finished_at = CASE WHEN $2 IN ('sent', 'failed', 'cancelled') THEN now() ELSE finished_at END,
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, status, patch.totalCount ?? null],
    );
    return rows[0] ?? null;
  }

  async enqueue(broadcastId, userIds) {
    const { rowCount } = await query(
      `INSERT INTO broadcast_deliveries (broadcast_id, user_id)
       SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`,
      [broadcastId, userIds],
    );
    return rowCount;
  }

  async pending(broadcastId, limit) {
    const { rows } = await query(
      `SELECT d.id, d.user_id, u.telegram_id FROM broadcast_deliveries d
       JOIN bot_users u ON u.id = d.user_id
       WHERE d.broadcast_id = $1 AND d.status = 'pending' AND NOT u.is_blocked
       ORDER BY d.id LIMIT $2`,
      [broadcastId, limit],
    );
    return rows;
  }

  async markDelivery(id, status, error) {
    await query(
      `UPDATE broadcast_deliveries SET status = $2, error = $3,
              sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
       WHERE id = $1`,
      [id, status, error ?? null],
    );
  }

  async refreshCounters(broadcastId) {
    const { rows } = await query(
      `UPDATE broadcasts b SET
         sent_count = stats.sent, failed_count = stats.failed
       FROM (SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent,
                    count(*) FILTER (WHERE status IN ('failed', 'blocked'))::int AS failed
             FROM broadcast_deliveries WHERE broadcast_id = $1) stats
       WHERE b.id = $1 RETURNING b.sent_count, b.failed_count, b.total_count`,
      [broadcastId],
    );
    return rows[0] ?? null;
  }

  async dueScheduled() {
    const { rows } = await query(
      `SELECT id FROM broadcasts
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()`,
    );
    return rows.map((row) => Number(row.id));
  }
}
