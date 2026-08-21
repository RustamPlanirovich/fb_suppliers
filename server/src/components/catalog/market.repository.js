import { query } from '../../utils/db.js';

// Рыночные цены площадок по варианту. Площадка — источник цен, не источник контактов.
export class MarketRepository {
  async listMarketplaces() {
    const { rows } = await query('SELECT * FROM marketplaces ORDER BY name');
    return rows;
  }

  async findMarketplace(code) {
    const { rows } = await query('SELECT * FROM marketplaces WHERE code = $1', [code]);
    return rows[0] ?? null;
  }

  async findMarketplaceById(id) {
    const { rows } = await query('SELECT * FROM marketplaces WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async upsertMarketplace({ code, name, commissionPct, payoutFee, url, isActive }) {
    const { rows } = await query(
      `INSERT INTO marketplaces (code, name, commission_pct, payout_fee, url, is_active)
       VALUES ($1, $2, $3, $4, $5, coalesce($6, TRUE))
       ON CONFLICT (code) DO UPDATE SET
         name = excluded.name, commission_pct = excluded.commission_pct,
         payout_fee = excluded.payout_fee, url = excluded.url, is_active = excluded.is_active
       RETURNING *`,
      [code, name, commissionPct ?? 0, payoutFee ?? 0, url ?? null, isActive],
    );
    return rows[0];
  }

  async addSnapshot(data) {
    const { rows } = await query(
      `INSERT INTO market_prices (variant_id, marketplace_id, price_min, price_avg, price_max,
                                  price_median, sellers_count, sales_count, source_url, source_node_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.variantId, data.marketplaceId, data.priceMin ?? null, data.priceAvg ?? null,
        data.priceMax ?? null, data.priceMedian ?? null, data.sellersCount ?? null,
        data.salesCount ?? null, data.sourceUrl ?? null, data.sourceNodeId ?? null],
    );
    return rows[0];
  }

  async latestByVariant(variantId) {
    const { rows } = await query(
      `SELECT DISTINCT ON (m.marketplace_id)
              m.*, mp.code, mp.name AS marketplace_name, mp.commission_pct, mp.payout_fee
       FROM market_prices m JOIN marketplaces mp ON mp.id = m.marketplace_id
       WHERE m.variant_id = $1
       ORDER BY m.marketplace_id, m.collected_at DESC`,
      [variantId],
    );
    return rows;
  }

  async series(variantId, marketplaceId, days) {
    const { rows } = await query(
      `SELECT date_trunc('day', collected_at) AS day,
              round(avg(price_avg)::numeric, 2) AS price_avg,
              min(price_min) AS price_min
       FROM market_prices
       WHERE variant_id = $1 AND marketplace_id = $2
         AND collected_at > now() - make_interval(days => $3)
       GROUP BY 1 ORDER BY 1`,
      [variantId, marketplaceId, days],
    );
    return rows;
  }
}
