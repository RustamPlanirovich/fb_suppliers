import { query } from '../../utils/db.js';
import { SqlBuilder, orderBy } from '../../utils/sql.js';

const ORDER = {
  roi: 'a.roi_pct DESC',
  profit: 'a.profit DESC',
  margin: 'a.margin_pct DESC',
  fresh: 'a.computed_at DESC',
};

const LINK_SELECT = `
  a.*, p.name AS product_name, v.name AS variant_name, v.competition AS variant_competition,
  v.trend_7d_pct, s.id AS supplier_id, s.name AS supplier_name, s.source AS supplier_source,
  s.score_reliability, s.confirmed_deals_30d, s.status AS supplier_status,
  m.code AS marketplace_code, m.name AS marketplace_name, o.url AS offer_url
`;

const JOINS = `
  FROM arbitrage_links a
  JOIN offers o ON o.id = a.offer_id
  JOIN suppliers s ON s.id = o.supplier_id
  JOIN product_variants v ON v.id = a.variant_id
  JOIN products p ON p.id = v.product_id
  JOIN marketplaces m ON m.id = a.marketplace_id
`;

export class ArbitrageRepository {
  // Исходные данные для расчёта: активные офферы + свежий срез рыночной цены.
  // Читается партиями: на большой базе весь набор в память не берём.
  async computeInputs(limit, offset = 0) {
    const { rows } = await query(
      `SELECT o.id AS offer_id, o.variant_id, o.price AS buy_price, o.price_checked_at,
              s.score_reliability, s.confirmed_deals_30d,
              mp.id AS marketplace_id, mp.commission_pct, mp.payout_fee,
              latest.price_avg AS sell_price, latest.sellers_count
       FROM offers o
       JOIN suppliers s ON s.id = o.supplier_id
       JOIN LATERAL (
         SELECT DISTINCT ON (marketplace_id) marketplace_id, price_avg, sellers_count
         FROM market_prices WHERE variant_id = o.variant_id
         ORDER BY marketplace_id, collected_at DESC
       ) latest ON TRUE
       JOIN marketplaces mp ON mp.id = latest.marketplace_id AND mp.is_active
       WHERE o.is_active AND o.price IS NOT NULL AND latest.price_avg IS NOT NULL
         AND NOT s.is_hidden AND s.merged_into_id IS NULL
         AND s.status IN ('verified', 'recheck')
       ORDER BY o.id
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async upsert(link) {
    const { rows } = await query(
      `INSERT INTO arbitrage_links (variant_id, offer_id, marketplace_id, buy_price, sell_price,
         commission_pct, payout_fee, profit, roi_pct, margin_pct, price_age_hours, competition,
         risk_level, is_active, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, now())
       ON CONFLICT (offer_id, marketplace_id) DO UPDATE SET
         buy_price = excluded.buy_price, sell_price = excluded.sell_price,
         commission_pct = excluded.commission_pct, payout_fee = excluded.payout_fee,
         profit = excluded.profit, roi_pct = excluded.roi_pct, margin_pct = excluded.margin_pct,
         price_age_hours = excluded.price_age_hours, competition = excluded.competition,
         risk_level = excluded.risk_level, is_active = TRUE, computed_at = now()
       RETURNING id`,
      [link.variantId, link.offerId, link.marketplaceId, link.buyPrice, link.sellPrice,
        link.commissionPct, link.payoutFee, link.profit, link.roiPct, link.marginPct,
        link.priceAgeHours, link.competition, link.riskLevel],
    );
    return rows[0];
  }

  async deactivateStale(hours) {
    const { rowCount } = await query(
      `UPDATE arbitrage_links SET is_active = FALSE
       WHERE is_active AND computed_at < now() - make_interval(hours => $1)`,
      [hours],
    );
    return rowCount;
  }

  async list(filters, paging) {
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.roiMin, 'a.roi_pct >= ?')
      .whereIf(filters.profitMin, 'a.profit >= ?')
      .whereIf(filters.variantId, 'a.variant_id = ?')
      .whereIf(filters.marketplaceId, 'a.marketplace_id = ?')
      .whereIf(filters.riskLevel, 'a.risk_level = ?')
      .whereIf(filters.adminMark, 'a.admin_mark = ?')
      .whereIf(filters.competition, 'a.competition = ?')
      .whereIf(filters.buyMax, 'a.buy_price <= ?');
    if (filters.activeOnly !== false) builder.where('a.is_active');
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT ${LINK_SELECT}, count(*) OVER () AS total_count ${JOINS}
       ${builder.clause} ORDER BY ${orderBy(ORDER, filters.sort, 'roi')}
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async setMark(id, mark, note) {
    const { rows } = await query(
      `UPDATE arbitrage_links SET admin_mark = $2, admin_note = coalesce($3, admin_note)
       WHERE id = $1 RETURNING *`,
      [id, mark, note ?? null],
    );
    return rows[0] ?? null;
  }
}
