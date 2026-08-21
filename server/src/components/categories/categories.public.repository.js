import { query } from '../../utils/db.js';
import { PUBLIC_SUPPLIER_STATUSES } from '../../utils/constants.js';

// Навигация бота по дереву категорий.
// Поставщик относится к категории, если у него есть активное предложение по её товару, —
// один поставщик торгует в разных разделах, поэтому поле category_id для этого не годится.
// Карточки, заведённые вручную без предложений, учитываются по собственной категории.
const SUPPLIERS_IN_BRANCH = `
  SELECT DISTINCT s.id
  FROM suppliers s
  LEFT JOIN offers o ON o.supplier_id = s.id AND o.is_active
  LEFT JOIN product_variants v ON v.id = o.variant_id
  LEFT JOIN products p ON p.id = v.product_id
  LEFT JOIN categories pc ON pc.id = p.category_id
  LEFT JOIN categories sc ON sc.id = s.category_id
  WHERE s.status = ANY($2) AND NOT s.is_hidden AND s.merged_into_id IS NULL
    AND (pc.path LIKE $branch || '%' OR (o.id IS NULL AND sc.path LIKE $branch || '%'))
`;
export class CategoriesPublicRepository {
  async children(parentId) {
    const { rows } = await query(
      `SELECT c.id, c.name, c.path, c.depth,
              (SELECT count(*)::int FROM categories x WHERE x.parent_id = c.id AND x.is_active) AS children_count,
              (SELECT count(*)::int FROM (${SUPPLIERS_IN_BRANCH.replaceAll('$branch', 'c.path')}) b)
                AS suppliers_count
       FROM categories c
       WHERE c.is_active AND c.parent_id IS NOT DISTINCT FROM $1
       ORDER BY c.sort_order, c.name`,
      [parentId ?? null, PUBLIC_SUPPLIER_STATUSES],
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await query(
      `SELECT c.*, p.name AS parent_name FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id WHERE c.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  // Поставщики ветки: сама категория и все вложенные.
  async suppliers(categoryId, { limit, offset }) {
    const branch = '(SELECT path FROM categories WHERE id = $1)';
    const { rows } = await query(
      `WITH branch_suppliers AS (${SUPPLIERS_IN_BRANCH.replaceAll('$branch', branch)})
       SELECT s.id, s.name, s.source, s.telegram, s.website, s.external_url,
              s.score_reliability, s.source_rating, s.source_reviews_count,
              s.confirmed_deals_30d, s.offers_count, s.quality_score,
              count(*) OVER () AS total_count
       FROM suppliers s JOIN branch_suppliers b ON b.id = s.id
       ORDER BY s.quality_score DESC NULLS LAST, s.score_reliability DESC NULLS LAST,
                s.confirmed_deals_30d DESC, s.name
       LIMIT $3 OFFSET $4`,
      [categoryId, PUBLIC_SUPPLIER_STATUSES, limit, offset],
    );
    return { rows, total: Number(rows[0]?.total_count ?? 0) };
  }

  // Поставщики, у которых есть предложение по варианту товара — для выдачи после поиска.
  async suppliersByVariant(variantId, { limit, offset }) {
    const { rows } = await query(
      `SELECT s.id, s.name, s.source, s.telegram, s.website, s.external_url,
              s.score_reliability, s.source_rating, s.confirmed_deals_30d, s.quality_score,
              o.price, o.currency, o.url AS offer_url,
              count(*) OVER () AS total_count
       FROM offers o
       JOIN suppliers s ON s.id = o.supplier_id
       WHERE o.variant_id = $1 AND o.is_active
         AND s.status = ANY($2) AND NOT s.is_hidden AND s.merged_into_id IS NULL
       ORDER BY o.price ASC NULLS LAST
       LIMIT $3 OFFSET $4`,
      [variantId, PUBLIC_SUPPLIER_STATUSES, limit, offset],
    );
    return { rows, total: Number(rows[0]?.total_count ?? 0) };
  }
}
