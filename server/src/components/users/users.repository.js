import { query } from '../../utils/db.js';
import { SqlBuilder } from '../../utils/sql.js';

const USER_SELECT = `
  u.id, u.telegram_id, u.username, u.language, u.is_blocked, u.blocked_note,
  u.last_seen_at, u.created_at,
  (SELECT count(*)::int FROM favorites f WHERE f.user_id = u.id) AS favorites_count,
  (SELECT count(*)::int FROM watchlist w WHERE w.user_id = u.id) AS watchlist_count,
  (SELECT count(*)::int FROM alerts al WHERE al.user_id = u.id AND al.is_active) AS alerts_count,
  sub.plan_code, sub.plan_name, sub.ends_at AS subscription_ends_at, sub.status AS subscription_status
`;

const SUB_JOIN = `
  LEFT JOIN LATERAL (
    SELECT p.code AS plan_code, p.name AS plan_name, s.ends_at, s.status
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = u.id AND s.status = 'active' AND s.ends_at > now()
    ORDER BY s.ends_at DESC LIMIT 1
  ) sub ON TRUE
`;

export class UsersRepository {
  async upsertFromTelegram({ telegramId, username, language }) {
    const { rows } = await query(
      `INSERT INTO bot_users (telegram_id, username, language)
       VALUES ($1, $2, coalesce($3, 'ru'))
       ON CONFLICT (telegram_id) DO UPDATE SET
         username = excluded.username, last_seen_at = now()
       RETURNING *`,
      [telegramId, username ?? null, language ?? null],
    );
    return rows[0];
  }

  async findByTelegramId(telegramId) {
    const { rows } = await query('SELECT * FROM bot_users WHERE telegram_id = $1', [telegramId]);
    return rows[0] ?? null;
  }

  async findById(id) {
    const { rows } = await query(
      `SELECT ${USER_SELECT} FROM bot_users u ${SUB_JOIN} WHERE u.id = $1`, [id]);
    return rows[0] ?? null;
  }

  async list(filters, paging) {
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.q, '(u.username ILIKE ? OR u.telegram_id::text ILIKE ?)',
        `%${filters.q}%`, `%${filters.q}%`)
      .whereIf(filters.createdFrom, 'u.created_at >= ?')
      .whereIf(filters.activeSince, 'u.last_seen_at >= ?');
    if (typeof filters.isBlocked === 'boolean') builder.where('u.is_blocked = ?', filters.isBlocked);
    if (filters.hasSubscription === true) builder.where('sub.plan_code IS NOT NULL');
    if (filters.hasSubscription === false) builder.where('sub.plan_code IS NULL');
    if (filters.planCode) builder.where('sub.plan_code = ?', filters.planCode);
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT ${USER_SELECT}, count(*) OVER () AS total_count
       FROM bot_users u ${SUB_JOIN} ${builder.clause}
       ORDER BY u.last_seen_at DESC LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  // Сегмент для рассылки: возвращает id и telegram_id по тем же фильтрам, что и список.
  async segment(filters, limit) {
    const builder = new SqlBuilder().where('NOT u.is_blocked');
    if (filters.planCode) builder.where('sub.plan_code = ?', filters.planCode);
    if (filters.hasSubscription === true) builder.where('sub.plan_code IS NOT NULL');
    if (filters.hasSubscription === false) builder.where('sub.plan_code IS NULL');
    builder.whereIf(filters.activeSince, 'u.last_seen_at >= ?');
    builder.whereIf(filters.createdFrom, 'u.created_at >= ?');
    const limitPlaceholder = builder.param(limit);
    const { rows } = await query(
      `SELECT u.id, u.telegram_id FROM bot_users u ${SUB_JOIN} ${builder.clause}
       ORDER BY u.id LIMIT ${limitPlaceholder}`,
      builder.params,
    );
    return rows;
  }

  async setBlocked(id, isBlocked, note) {
    const { rows } = await query(
      `UPDATE bot_users SET is_blocked = $2, blocked_note = $3 WHERE id = $1 RETURNING *`,
      [id, isBlocked, note ?? null],
    );
    return rows[0] ?? null;
  }

  async favorites(userId) {
    const { rows } = await query(
      `SELECT s.id, s.name, s.status, s.score_reliability, f.created_at
       FROM favorites f JOIN suppliers s ON s.id = f.supplier_id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async touch(id) {
    await query('UPDATE bot_users SET last_seen_at = now() WHERE id = $1', [id]);
  }
}
