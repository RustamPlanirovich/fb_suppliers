import { query } from '../../utils/db.js';
import { SqlBuilder, orderBy } from '../../utils/sql.js';

const ORDER = {
  price: 'o.price ASC NULLS LAST',
  reliability: 's.score_reliability DESC NULLS LAST',
  deals: 's.confirmed_deals_30d DESC',
  fresh: 'o.price_checked_at DESC',
  updated: 'o.updated_at DESC',
};

const OFFER_SELECT = `
  o.id, o.variant_id, o.supplier_id, o.title, o.price, o.prev_price, o.currency,
  o.min_qty, o.stock, o.url, o.external_id, o.is_active,
  o.price_checked_at, o.price_changed_at, o.created_at, o.updated_at,
  s.name AS supplier_name, s.source AS supplier_source, s.status AS supplier_status,
  s.score_reliability, s.confirmed_deals_30d, s.complaints_count, s.quality_score,
  v.name AS variant_name, p.name AS product_name
`;

const JOINS = `
  FROM offers o
  JOIN suppliers s ON s.id = o.supplier_id
  JOIN product_variants v ON v.id = o.variant_id
  JOIN products p ON p.id = v.product_id
`;

export class OffersRepository {
  async findById(id) {
    const { rows } = await query(`SELECT ${OFFER_SELECT} ${JOINS} WHERE o.id = $1`, [id]);
    return rows[0] ?? null;
  }

  async list(filters, paging) {
    const builder = this.#conditions(filters);
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT ${OFFER_SELECT}, count(*) OVER () AS total_count ${JOINS}
       ${builder.clause} ORDER BY ${orderBy(ORDER, filters.sort, 'price')}
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  #conditions(filters) {
    const builder = new SqlBuilder().where('s.merged_into_id IS NULL');
    builder
      .whereIf(filters.variantId, 'o.variant_id = ?')
      .whereIf(filters.supplierId, 'o.supplier_id = ?')
      .whereIf(filters.priceMax, 'o.price <= ?')
      .whereIf(filters.priceMin, 'o.price >= ?')
      .whereIf(filters.supplierStatus, 's.status = ANY(?)', filters.supplierStatus)
      .whereIf(filters.q, '(o.title ILIKE ? OR p.name ILIKE ? OR v.name ILIKE ?)',
        `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    if (typeof filters.isActive === 'boolean') builder.where('o.is_active = ?', filters.isActive);
    if (filters.publicOnly) builder.where('NOT s.is_hidden');
    if (filters.staleDays) {
      builder.where('o.price_checked_at < now() - make_interval(days => ?)', filters.staleDays);
    }
    return builder;
  }

  // Лучшие (самые дешёвые) предложения по варианту — основа ответа «найти где дешевле».
  async cheapestByVariant(variantId, { limit, statuses }) {
    const { rows } = await query(
      `SELECT ${OFFER_SELECT} ${JOINS}
       WHERE o.variant_id = $1 AND o.is_active AND NOT s.is_hidden
         AND s.merged_into_id IS NULL AND s.status = ANY($2)
       ORDER BY o.price ASC NULLS LAST LIMIT $3`,
      [variantId, statuses, limit],
    );
    return rows;
  }

  async create(data) {
    const { rows } = await query(
      `INSERT INTO offers (variant_id, supplier_id, title, price, currency, min_qty, stock, url,
                           external_id, is_active, price_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, TRUE), now())
       RETURNING *`,
      [data.variantId, data.supplierId, data.title ?? null, data.price ?? null,
        data.currency ?? 'RUB', data.minQty ?? 1, data.stock ?? null, data.url ?? null,
        data.externalId ?? null, data.isActive],
    );
    return rows[0];
  }

  async updateFields(id, data) {
    const { rows } = await query(
      `UPDATE offers SET
         title = coalesce($2, title),
         currency = coalesce($3, currency),
         min_qty = coalesce($4, min_qty),
         stock = $5,
         url = coalesce($6, url),
         is_active = coalesce($7, is_active),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, data.title ?? null, data.currency ?? null, data.minQty ?? null,
        data.stock ?? null, data.url ?? null, data.isActive ?? null],
    );
    return rows[0] ?? null;
  }

  // Цена меняется отдельным методом: сохраняем предыдущее значение и отметки свежести.
  async applyPrice(id, price, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
      `UPDATE offers SET
         prev_price = price,
         price = $2,
         price_changed_at = CASE WHEN price IS DISTINCT FROM $2 THEN now() ELSE price_changed_at END,
         price_checked_at = now(),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, price],
    );
    return rows[0] ?? null;
  }

  // Предложение, полученное из источника: цена обновляется вместе с отметками свежести.
  async upsertExternal(data) {
    const { rows } = await query(
      `INSERT INTO offers (variant_id, supplier_id, title, price, currency, url, external_id,
                           is_active, price_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, now())
       ON CONFLICT (supplier_id, variant_id) DO UPDATE SET
         title = excluded.title,
         prev_price = offers.price,
         price = excluded.price,
         currency = excluded.currency,
         url = excluded.url,
         external_id = excluded.external_id,
         is_active = TRUE,
         price_changed_at = CASE WHEN offers.price IS DISTINCT FROM excluded.price
                              THEN now() ELSE offers.price_changed_at END,
         price_checked_at = now(),
         updated_at = now()
       RETURNING id, price, prev_price, (xmax = 0) AS inserted`,
      [data.variantId, data.supplierId, data.title ?? null, data.price, data.currency ?? 'RUB',
        data.url ?? null, data.externalId ?? null],
    );
    return rows[0];
  }

  // Предложения источника, пропавшие из последней выгрузки, снимаются с публикации.
  async deactivateMissing(variantId, keepOfferIds, source) {
    const { rowCount } = await query(
      `UPDATE offers o SET is_active = FALSE, updated_at = now()
       FROM suppliers s
       WHERE s.id = o.supplier_id AND s.source = $3
         AND o.variant_id = $1 AND o.is_active
         AND NOT (o.external_id = ANY($2::text[]))`,
      [variantId, keepOfferIds, source],
    );
    return rowCount;
  }

  async touchChecked(ids) {
    const { rowCount } = await query(
      'UPDATE offers SET price_checked_at = now() WHERE id = ANY($1::bigint[])', [ids]);
    return rowCount;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM offers WHERE id = $1', [id]);
    return rowCount > 0;
  }

  async findBySupplierAndVariant(supplierId, variantId) {
    const { rows } = await query(
      'SELECT * FROM offers WHERE supplier_id = $1 AND variant_id = $2', [supplierId, variantId]);
    return rows[0] ?? null;
  }
}
