import { query } from '../../utils/db.js';

// Границы витрины дашборда: ниже — неинтересно, выше — почти всегда мусорные данные.
const SHOWCASE = { MIN_ROI: 5, MAX_ROI: 300, MIN_BUY_PRICE: 20 };

// Ряды для графика на дашборде и списки «что происходило» — по дням.
export class TimeseriesRepository {
  // Ряд активности по дням: поиски, открытия контактов, новые карточки.
  async daily(metric, days) {
    const sources = {
      searches: "SELECT created_at FROM search_queries",
      contacts: "SELECT created_at FROM bot_events WHERE type = 'contact_open'",
      suppliers: 'SELECT created_at FROM suppliers WHERE merged_into_id IS NULL',
      offers: 'SELECT created_at FROM offers',
    };
    const source = sources[metric] ?? sources.searches;
    const { rows } = await query(
      `WITH days AS (
         SELECT generate_series(
           date_trunc('day', now()) - make_interval(days => $1 - 1),
           date_trunc('day', now()),
           interval '1 day') AS day
       ), events AS (${source})
       SELECT d.day,
              count(e.created_at)::int AS value
       FROM days d LEFT JOIN events e ON date_trunc('day', e.created_at) = d.day
       GROUP BY d.day ORDER BY d.day`,
      [days],
    );
    return rows;
  }

  // Последние изменения цен — аналог ленты операций.
  async recentPriceChanges(limit) {
    const { rows } = await query(
      `SELECT h.id, h.price, h.currency, h.source, h.created_at,
              s.name AS supplier_name, s.source AS supplier_source,
              p.name AS product_name, v.name AS variant_name,
              o.prev_price
       FROM offer_price_history h
       JOIN offers o ON o.id = h.offer_id
       JOIN suppliers s ON s.id = o.supplier_id
       JOIN product_variants v ON v.id = o.variant_id
       JOIN products p ON p.id = v.product_id
       ORDER BY h.created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  // Доли по товарам — для списка с процентами в боковой колонке.
  async shareByProduct(limit) {
    const { rows } = await query(
      `SELECT p.name,
              sum(v.offers_count)::int AS offers,
              round(sum(v.offers_count) * 100.0 / nullif(sum(sum(v.offers_count)) OVER (), 0), 1) AS share
       FROM products p JOIN product_variants v ON v.product_id = p.id
       GROUP BY p.name HAVING sum(v.offers_count) > 0
       ORDER BY offers DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  // Лучшие связки для витрины наверху дашборда.
  // Витрина отсекает аномалии: копеечная закупка даёт ROI в тысячи процентов и вытесняет
  // реальные связки. Такие записи остаются в общем списке и разбираются отдельно.
  async topLinks(limit) {
    const { rows } = await query(
      `SELECT a.id, a.buy_price, a.sell_price, a.profit, a.roi_pct, a.risk_level,
              p.name AS product_name, v.name AS variant_name, s.name AS supplier_name
       FROM arbitrage_links a
       JOIN offers o ON o.id = a.offer_id
       JOIN suppliers s ON s.id = o.supplier_id
       JOIN product_variants v ON v.id = a.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE a.is_active AND a.admin_mark <> 'stale'
         AND a.roi_pct BETWEEN $2 AND $3 AND a.buy_price >= $4
       ORDER BY a.roi_pct DESC LIMIT $1`,
      [limit, SHOWCASE.MIN_ROI, SHOWCASE.MAX_ROI, SHOWCASE.MIN_BUY_PRICE],
    );
    return rows;
  }
}
