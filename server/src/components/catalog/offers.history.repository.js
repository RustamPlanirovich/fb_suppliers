import { query } from '../../utils/db.js';

// История цены оффера + доказательство происхождения правки.
export class OffersHistoryRepository {
  async add({ offerId, price, currency, source, evidence, adminId }, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
      `INSERT INTO offer_price_history (offer_id, price, currency, source, evidence, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [offerId, price, currency ?? 'RUB', source ?? 'admin', evidence ?? null, adminId ?? null],
    );
    return rows[0];
  }

  async byOffer(offerId, limit) {
    const { rows } = await query(
      `SELECT h.id, h.price, h.currency, h.source, h.evidence, h.created_at, a.name AS admin_name
       FROM offer_price_history h LEFT JOIN admins a ON a.id = h.admin_id
       WHERE h.offer_id = $1 ORDER BY h.created_at DESC LIMIT $2`,
      [offerId, limit],
    );
    return rows;
  }

  // Динамика минимальной закупочной цены по варианту — график для карточки товара.
  async variantSeries(variantId, days) {
    const { rows } = await query(
      `SELECT date_trunc('day', h.created_at) AS day,
              min(h.price) AS price_min,
              round(avg(h.price)::numeric, 2) AS price_avg
       FROM offer_price_history h
       JOIN offers o ON o.id = h.offer_id
       WHERE o.variant_id = $1 AND h.created_at > now() - make_interval(days => $2)
       GROUP BY 1 ORDER BY 1`,
      [variantId, days],
    );
    return rows;
  }
}
