import { query } from '../../utils/db.js';
import { SqlBuilder, orderBy } from '../../utils/sql.js';

// Порядок выдачи: что считать «самым выгодным» решает администратор сортировкой.
const ORDER = {
  margin: 'o.margin_pct DESC NULLS LAST',
  profit: 'o.profit DESC NULLS LAST',
  demand: 'o.demand_score DESC',
  competition: 'o.sellers_count ASC NULLS LAST',
  trend_down: 'o.trend_7d_pct ASC NULLS LAST',
  trend_up: 'o.trend_7d_pct DESC NULLS LAST',
  suppliers: 'o.suppliers_count DESC',
  price: 'o.buy_min ASC NULLS LAST',
};

// Готовые связки условий под типовые вопросы администратора и подписчика.
export const PRESETS = {
  buy: { marginMin: 20, trendMax: 0, suppliersMin: 2, sort: 'margin' },
  sell: { marginMin: 20, competition: 'low', sort: 'margin' },
  rising: { demandMin: 1, sort: 'demand' },
  falling: { trendMax: -5, sort: 'trend_down' },
};

export class OpportunitiesRepository {
  // Витрина «что выгодно»: закупка, продажа, маржа, конкуренция, тренд и спрос по вариантам.
  async list(filters, paging) {
    const builder = new SqlBuilder();
    builder.where('o.buy_min IS NOT NULL AND o.sell_avg IS NOT NULL');
    builder
      .whereIf(filters.marginMin, 'o.margin_pct >= ?')
      .whereIf(filters.marginMax, 'o.margin_pct <= ?')
      .whereIf(filters.competition, 'o.competition = ?')
      .whereIf(filters.priceMax, 'o.buy_min <= ?')
      .whereIf(filters.priceMin, 'o.buy_min >= ?')
      .whereIf(filters.suppliersMin, 'o.suppliers_count >= ?')
      .whereIf(filters.sellersMax, 'o.sellers_count <= ?')
      .whereIf(filters.demandMin, 'o.demand_score >= ?')
      .whereIf(filters.profitMin, 'o.profit >= ?')
      .whereIf(filters.categoryId, 'o.category_id = ?')
      .whereIf(filters.q, '(o.product_name ILIKE ? OR o.variant_name ILIKE ?)',
        `%${filters.q}%`, `%${filters.q}%`);
    // Тренд: отрицательный порог означает «цена снижается не меньше чем на N%».
    if (filters.trendMax !== undefined && filters.trendMax !== null && filters.trendMax !== '') {
      builder.where('o.trend_7d_pct <= ?', filters.trendMax);
    }
    if (filters.trendMin !== undefined && filters.trendMin !== null && filters.trendMin !== '') {
      builder.where('o.trend_7d_pct >= ?', filters.trendMin);
    }

    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `WITH base AS (
         SELECT v.id, v.name AS variant_name, p.name AS product_name, p.category_id,
                v.buy_min, v.buy_avg, v.sell_avg, v.margin_pct, v.competition,
                v.trend_7d_pct, v.demand_score, v.suppliers_count, v.sellers_count,
                market.commission_pct, market.payout_fee,
                round((v.sell_avg
                       - v.sell_avg * coalesce(market.commission_pct, 0) / 100
                       - coalesce(market.payout_fee, 0)
                       - v.buy_min)::numeric, 2) AS profit
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         LEFT JOIN LATERAL (
           SELECT mp.commission_pct, mp.payout_fee
           FROM market_prices m JOIN marketplaces mp ON mp.id = m.marketplace_id
           WHERE m.variant_id = v.id ORDER BY m.collected_at DESC LIMIT 1
         ) market ON TRUE
         WHERE v.is_active AND p.is_active
       )
       SELECT o.*, count(*) OVER () AS total_count FROM base o
       ${builder.clause}
       ORDER BY ${orderBy(ORDER, filters.sort, 'margin')}
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }
}
