import { query } from '../../utils/db.js';

// Сводка для дашборда. Один запрос на блок, все счётчики — за переданный период в днях.
export class DashboardRepository {
  async suppliers() {
    const { rows } = await query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'verified' AND NOT is_hidden)::int AS active,
         count(*) FILTER (WHERE is_hidden)::int AS hidden,
         count(*) FILTER (WHERE status IN ('pending', 'recheck'))::int AS needs_check,
         count(*) FILTER (WHERE status = 'blocked')::int AS blocked
       FROM suppliers WHERE merged_into_id IS NULL`,
    );
    return rows[0];
  }

  async newSuppliers(days) {
    const { rows } = await query(
      `SELECT count(*)::int AS count FROM suppliers
       WHERE merged_into_id IS NULL AND created_at > now() - make_interval(days => $1)`,
      [days],
    );
    return rows[0].count;
  }

  async catalog() {
    const { rows } = await query(
      `SELECT
         (SELECT count(*)::int FROM products) AS products,
         (SELECT count(*)::int FROM product_variants WHERE is_active) AS variants,
         (SELECT count(*)::int FROM offers WHERE is_active) AS offers,
         (SELECT count(*)::int FROM arbitrage_links WHERE is_active AND roi_pct >= 20) AS opportunities`,
    );
    return rows[0];
  }

  async users(days) {
    const { rows } = await query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE created_at > now() - make_interval(days => $1))::int AS new_users,
         count(*) FILTER (WHERE last_seen_at > now() - make_interval(days => $1))::int AS active_users,
         count(*) FILTER (WHERE is_blocked)::int AS blocked
       FROM bot_users`,
      [days],
    );
    return rows[0];
  }

  async events(days) {
    const { rows } = await query(
      `SELECT type, count(*)::int AS count FROM bot_events
       WHERE created_at > now() - make_interval(days => $1) GROUP BY type`,
      [days],
    );
    return Object.fromEntries(rows.map((row) => [row.type, row.count]));
  }

  async searches(days) {
    const { rows } = await query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE results_count = 0)::int AS empty
       FROM search_queries WHERE created_at > now() - make_interval(days => $1)`,
      [days],
    );
    return rows[0];
  }

  async moderation() {
    const { rows } = await query(
      `SELECT
         (SELECT count(*)::int FROM complaints WHERE status IN ('new', 'in_progress')) AS complaints,
         (SELECT count(*)::int FROM reviews WHERE status = 'pending') AS reviews,
         (SELECT count(*)::int FROM submissions WHERE status = 'new') AS submissions,
         (SELECT count(*)::int FROM data_flags WHERE status = 'open') AS flags`,
    );
    return rows[0];
  }

  async revenue(days) {
    const { rows } = await query(
      `SELECT coalesce(sum(amount), 0) AS amount, count(*)::int AS payments
       FROM payments WHERE status = 'paid' AND paid_at > now() - make_interval(days => $1)`,
      [days],
    );
    return rows[0];
  }
}
