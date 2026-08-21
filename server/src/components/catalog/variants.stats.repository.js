import { query } from '../../utils/db.js';

// Пересчёт агрегатов варианта: закупка, продажа, маржа, конкуренция, тренд, спрос.
export class VariantsStatsRepository {
  async refresh(variantId) {
    const { rows } = await query(
      `WITH buy AS (
         SELECT count(*)::int AS offers_count,
                count(DISTINCT o.supplier_id)::int AS suppliers_count,
                min(o.price) AS buy_min, max(o.price) AS buy_max,
                round(avg(o.price)::numeric, 2) AS buy_avg,
                round(percentile_cont(0.5) WITHIN GROUP (ORDER BY o.price)::numeric, 2) AS buy_median
         FROM offers o JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.variant_id = $1 AND o.is_active AND NOT s.is_hidden
           AND s.merged_into_id IS NULL
           -- статистика рынка: учитываются и непроверенные карточки, кроме снятых с публикации.
           -- Выдача бота фильтруется строже (PUBLIC_SUPPLIER_STATUSES).
           AND s.status IN ('verified', 'recheck', 'pending')
       ), sell AS (
         SELECT DISTINCT ON (marketplace_id) price_avg, price_min, price_max, sellers_count
         FROM market_prices WHERE variant_id = $1
         ORDER BY marketplace_id, collected_at DESC
       ), sell_agg AS (
         SELECT round(avg(price_avg)::numeric, 2) AS sell_avg,
                min(price_min) AS sell_min, max(price_max) AS sell_max,
                max(sellers_count) AS sellers_count
         FROM sell
       ), trend AS (
         SELECT round((
           (min(h.price) FILTER (WHERE h.created_at > now() - interval '2 days')
            - min(h.price) FILTER (WHERE h.created_at < now() - interval '7 days'))
           / nullif(min(h.price) FILTER (WHERE h.created_at < now() - interval '7 days'), 0) * 100
         )::numeric, 2) AS trend_pct
         FROM offer_price_history h JOIN offers o ON o.id = h.offer_id
         WHERE o.variant_id = $1 AND h.created_at > now() - interval '30 days'
       ), demand AS (
         SELECT count(*)::numeric AS hits FROM bot_events
         WHERE variant_id = $1 AND created_at > now() - interval '7 days'
       )
       UPDATE product_variants v SET
         offers_count = buy.offers_count,
         suppliers_count = buy.suppliers_count,
         buy_min = buy.buy_min, buy_max = buy.buy_max, buy_avg = buy.buy_avg,
         buy_median = buy.buy_median,
         sell_avg = sell_agg.sell_avg, sell_min = sell_agg.sell_min, sell_max = sell_agg.sell_max,
         sellers_count = sell_agg.sellers_count,
         margin_pct = CASE WHEN sell_agg.sell_avg > 0 AND buy.buy_min IS NOT NULL
                        THEN round(((sell_agg.sell_avg - buy.buy_min) / sell_agg.sell_avg * 100)::numeric, 2)
                        ELSE NULL END,
         competition = CASE
                        WHEN sell_agg.sellers_count IS NULL THEN NULL
                        WHEN sell_agg.sellers_count <= 5 THEN 'low'
                        WHEN sell_agg.sellers_count <= 20 THEN 'medium'
                        ELSE 'high' END,
         trend_7d_pct = trend.trend_pct,
         demand_score = demand.hits,
         stats_updated_at = now()
       FROM buy, sell_agg, trend, demand
       WHERE v.id = $1
       RETURNING v.id, v.buy_min, v.buy_median, v.sell_avg, v.margin_pct, v.competition,
                 v.trend_7d_pct`,
      [variantId],
    );
    return rows[0] ?? null;
  }

  // Пересчёт всех устаревших вариантов партиями: на большой базе их тысячи,
  // и обрывать выборку на первой сотне — значит показывать администратору неполные данные.
  async refreshAllStale({ batch = 200, maxBatches = 50 } = {}) {
    let refreshed = 0;
    for (let i = 0; i < maxBatches; i += 1) {
      const ids = await this.staleIds(batch);
      if (!ids.length) return { refreshed, truncated: false };
      await this.refreshMany(ids);
      refreshed += ids.length;
    }
    return { refreshed, truncated: true };
  }

  async refreshMany(variantIds) {
    const results = [];
    for (const id of variantIds) results.push(await this.refresh(id));
    return results.filter(Boolean);
  }

  // Варианты, у которых агрегаты устарели — для фоновой пересборки.
  async staleIds(limit) {
    const { rows } = await query(
      `SELECT id FROM product_variants
       WHERE stats_updated_at IS NULL OR stats_updated_at < now() - interval '1 hour'
       ORDER BY stats_updated_at NULLS FIRST LIMIT $1`,
      [limit],
    );
    return rows.map((row) => Number(row.id));
  }
}
