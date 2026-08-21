import { query } from '../../utils/db.js';
import { SqlBuilder, orderBy } from '../../utils/sql.js';

// Товар в списке — свёрнутая группа своих вариантов, поэтому показатели агрегируются.
const ORDER = {
  name: 'p.name ASC',
  margin: 'stats.margin_max DESC NULLS LAST',
  offers: 'stats.offers DESC',
  suppliers: 'stats.suppliers DESC',
  price: 'stats.buy_min ASC NULLS LAST',
  demand: 'stats.demand DESC',
  variants: 'stats.variants DESC',
};

const STATS = `
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS variants,
           coalesce(sum(v.offers_count), 0)::int AS offers,
           coalesce(sum(v.suppliers_count), 0)::int AS suppliers,
           min(v.buy_min) AS buy_min,
           round(avg(v.buy_median)::numeric, 2) AS buy_median,
           round(avg(v.sell_avg)::numeric, 2) AS sell_avg,
           max(v.margin_pct) AS margin_max,
           coalesce(sum(v.demand_score), 0) AS demand,
           min(v.competition) AS competition_best
    FROM product_variants v WHERE v.product_id = p.id
  ) stats ON TRUE
`;

export class ProductsRepository {
  async list(filters, paging) {
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.categoryId, 'p.category_id = ?')
      .whereIf(filters.q, '(p.name ILIKE ? OR p.description ILIKE ?)',
        `%${filters.q}%`, `%${filters.q}%`)
      .whereIf(filters.marginMin, 'stats.margin_max >= ?')
      .whereIf(filters.priceMax, 'stats.buy_min <= ?');
    if (typeof filters.isActive === 'boolean') builder.where('p.is_active = ?', filters.isActive);
    if (filters.hasOffers) builder.where('stats.offers > 0');
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT p.id, p.name, p.slug, p.category_id, p.is_active, p.created_at,
              c.name AS category_name,
              stats.variants AS variants_count, stats.offers AS offers_count,
              stats.suppliers AS suppliers_count, stats.buy_min, stats.buy_median, stats.sell_avg,
              stats.margin_max, stats.demand, stats.competition_best,
              count(*) OVER () AS total_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${STATS}
       ${builder.clause}
       ORDER BY ${orderBy(ORDER, filters.sort, 'name')}
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async findBySlug(slug) {
    const { rows } = await query('SELECT * FROM products WHERE slug = $1', [slug]);
    return rows[0] ?? null;
  }

  async create({ name, slug, categoryId, description }) {
    const { rows } = await query(
      `INSERT INTO products (name, slug, category_id, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, slug, categoryId ?? null, description ?? null],
    );
    return rows[0];
  }

  async update(id, { name, categoryId, description, isActive }) {
    const { rows } = await query(
      `UPDATE products SET
         name = coalesce($2, name),
         category_id = coalesce($3, category_id),
         description = coalesce($4, description),
         is_active = coalesce($5, is_active)
       WHERE id = $1 RETURNING *`,
      [id, name ?? null, categoryId ?? null, description ?? null, isActive ?? null],
    );
    return rows[0] ?? null;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
    return rowCount > 0;
  }
}
