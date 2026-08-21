import { query } from '../../utils/db.js';

// Экран «Что сейчас происходит на рынке».
export class MarketAnalyticsRepository {
  async topQueries(days, limit) {
    const { rows } = await query(
      `SELECT query_norm, count(*)::int AS count,
              max(results_count) AS best_results
       FROM search_queries WHERE created_at > now() - make_interval(days => $1)
       GROUP BY query_norm ORDER BY count DESC LIMIT $2`,
      [days, limit],
    );
    return rows;
  }

  // Главный список пополнения базы: ищут часто, а поставщиков нет.
  async emptyQueries(days, limit) {
    const { rows } = await query(
      `SELECT query_norm, count(*)::int AS count, max(created_at) AS last_at
       FROM search_queries
       WHERE created_at > now() - make_interval(days => $1) AND results_count = 0
       GROUP BY query_norm ORDER BY count DESC LIMIT $2`,
      [days, limit],
    );
    return rows;
  }

  async topVariants(days, limit) {
    const { rows } = await query(
      `SELECT v.id, p.name AS product_name, v.name AS variant_name,
              count(*)::int AS views, v.margin_pct, v.buy_min, v.sell_avg, v.competition
       FROM bot_events e
       JOIN product_variants v ON v.id = e.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE e.created_at > now() - make_interval(days => $1) AND e.variant_id IS NOT NULL
       GROUP BY v.id, p.name, v.name, v.margin_pct, v.buy_min, v.sell_avg, v.competition
       ORDER BY views DESC LIMIT $2`,
      [days, limit],
    );
    return rows;
  }

  async topMargin(limit) {
    const { rows } = await query(
      `SELECT v.id, p.name AS product_name, v.name AS variant_name, v.buy_min, v.sell_avg,
              v.margin_pct, v.suppliers_count, v.competition, v.trend_7d_pct
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.margin_pct IS NOT NULL AND v.offers_count > 0
       ORDER BY v.margin_pct DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async topSuppliers(days, limit) {
    const { rows } = await query(
      `SELECT s.id, s.name, count(*)::int AS opens, s.score_reliability, s.confirmed_deals_30d
       FROM bot_events e JOIN suppliers s ON s.id = e.supplier_id
       WHERE e.type = 'contact_open' AND e.created_at > now() - make_interval(days => $1)
       GROUP BY s.id ORDER BY opens DESC LIMIT $2`,
      [days, limit],
    );
    return rows;
  }

  async decliningSuppliers(limit) {
    const { rows } = await query(
      `SELECT s.id, s.name, s.score_reliability, s.complaints_count, s.problem_rate
       FROM suppliers s
       WHERE s.merged_into_id IS NULL AND s.complaints_count > 0
       ORDER BY s.complaints_count DESC, s.score_reliability ASC NULLS FIRST LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async alertTypes(limit) {
    const { rows } = await query(
      `SELECT type, count(*)::int AS count FROM alerts WHERE is_active
       GROUP BY type ORDER BY count DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async savedVariants(limit) {
    const { rows } = await query(
      `SELECT v.id, p.name AS product_name, v.name AS variant_name, count(*)::int AS saves
       FROM watchlist w
       JOIN product_variants v ON v.id = w.variant_id
       JOIN products p ON p.id = v.product_id
       GROUP BY v.id, p.name, v.name ORDER BY saves DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
}
