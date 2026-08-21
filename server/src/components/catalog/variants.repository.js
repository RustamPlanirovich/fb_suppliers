import { query } from '../../utils/db.js';
import { SqlBuilder, orderBy } from '../../utils/sql.js';

const ORDER = {
  margin: 'v.margin_pct DESC NULLS LAST',
  demand: 'v.demand_score DESC',
  price: 'v.buy_min ASC NULLS LAST',
  trend: 'v.trend_7d_pct ASC NULLS LAST',
  name: 'p.name ASC, v.name ASC',
  suppliers: 'v.suppliers_count DESC',
};

const VARIANT_SELECT = `
  v.*, p.name AS product_name, p.slug AS product_slug, p.category_id, c.name AS category_name
`;

export class VariantsRepository {
  async findById(id) {
    const { rows } = await query(
      `SELECT ${VARIANT_SELECT} FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE v.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(filters, paging) {
    const builder = this.#conditions(filters);
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT ${VARIANT_SELECT}, count(*) OVER () AS total_count
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       ${builder.clause}
       ORDER BY ${orderBy(ORDER, filters.sort, 'name')}
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  #conditions(filters) {
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.productId, 'v.product_id = ?')
      .whereIf(filters.categoryId, 'p.category_id = ?')
      .whereIf(filters.marginMin, 'v.margin_pct >= ?')
      .whereIf(filters.competition, 'v.competition = ?')
      .whereIf(filters.priceMax, 'v.buy_min <= ?');
    if (typeof filters.isActive === 'boolean') builder.where('v.is_active = ?', filters.isActive);
    if (filters.q) builder.where('v.search_vector @@ plainto_tsquery(\'simple\', ?)', filters.q);
    if (filters.hasOffers) builder.where('v.offers_count > 0');
    return builder;
  }

  // Поиск варианта по тому, что ввёл человек. Порядок совпадений:
  // точный синоним → начало синонима → подстрока → похожие по триграммам → полнотекстовый.
  // $1 — нормализованный запрос, $2 — ключ сравнения (латиница без пробелов).
  async search(text, limit, key, skeleton) {
    const { rows } = await query(
      `WITH matched AS (
         SELECT a.product_id,
                max(CASE
                  WHEN a.alias_key = $2 OR a.alias_norm = $1 THEN 1.0
                  WHEN a.alias_key LIKE $2 || '%' THEN 0.9
                  WHEN length($2) >= 3 AND a.alias_key LIKE '%' || $2 || '%' THEN 0.75
                  WHEN $5 <> '' AND a.alias_skel = $5 THEN 0.7
                  WHEN $5 <> '' AND a.alias_skel LIKE $5 || '%' THEN 0.6
                  ELSE similarity(a.alias_key, $2)
                END) AS score
         FROM product_aliases a
         WHERE a.alias_key = $2
            OR a.alias_norm = $1
            OR a.alias_key LIKE $2 || '%'
            OR (length($2) >= 3 AND a.alias_key LIKE '%' || $2 || '%')
            OR ($5 <> '' AND a.alias_skel LIKE $5 || '%')
            OR similarity(a.alias_key, $2) >= 0.3
         GROUP BY a.product_id
       )
       SELECT ${VARIANT_SELECT},
              coalesce(m.score, 0) AS alias_score,
              ts_rank(v.search_vector, plainto_tsquery('simple', $1)) AS rank
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN matched m ON m.product_id = p.id
       WHERE v.is_active AND p.is_active
         AND (m.product_id IS NOT NULL
              OR v.search_vector @@ plainto_tsquery('simple', $1)
              OR v.search_vector @@ plainto_tsquery('russian', $1)
              OR p.name ILIKE $3 OR v.name ILIKE $3)
       -- Сначала точность совпадения по синониму, затем близкие по релевантности варианты
       -- округляются к одному рангу — иначе короткое название обгоняет полное только
       -- за счёт нормализации длины документа в ts_rank.
       ORDER BY round(coalesce(m.score, 0)::numeric, 2) DESC,
                round(ts_rank(v.search_vector, plainto_tsquery('simple', $1))::numeric, 3) DESC,
                v.offers_count DESC
       LIMIT $4`,
      [text, key, `%${text}%`, limit, skeleton ?? ''],
    );
    return rows;
  }

  async create({ productId, name, attrs }) {
    const { rows } = await query(
      'INSERT INTO product_variants (product_id, name, attrs) VALUES ($1, $2, $3) RETURNING *',
      [productId, name, JSON.stringify(attrs ?? {})],
    );
    return rows[0];
  }

  async update(id, { name, attrs, isActive }) {
    const { rows } = await query(
      `UPDATE product_variants SET
         name = coalesce($2, name),
         attrs = coalesce($3, attrs),
         is_active = coalesce($4, is_active)
       WHERE id = $1 RETURNING *`,
      [id, name ?? null, attrs ? JSON.stringify(attrs) : null, isActive ?? null],
    );
    return rows[0] ?? null;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM product_variants WHERE id = $1', [id]);
    return rowCount > 0;
  }

  async findByName(productId, name) {
    const { rows } = await query(
      'SELECT * FROM product_variants WHERE product_id = $1 AND lower(name) = lower($2)',
      [productId, name],
    );
    return rows[0] ?? null;
  }
}
