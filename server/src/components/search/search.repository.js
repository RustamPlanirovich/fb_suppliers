import { query } from '../../utils/db.js';

// Журнал поисков — источник аналитики «что ищут» и «что ищут, а у нас нет».
export class SearchRepository {
  async log({ userId, text, normalized, resultsCount }) {
    await query(
      `INSERT INTO search_queries (user_id, query, query_norm, results_count)
       VALUES ($1, $2, $3, $4)`,
      [userId ?? null, text.slice(0, 300), normalized.slice(0, 300), resultsCount],
    );
  }

  async logEvent({ userId, type, supplierId, variantId, payload }) {
    await query(
      `INSERT INTO bot_events (user_id, type, supplier_id, variant_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId ?? null, type, supplierId ?? null, variantId ?? null, JSON.stringify(payload ?? {})],
    );
  }

  // Закреплённые за деньги поставщики: показываются первыми ограниченное время.
  async promotedSupplierIds(categoryId) {
    const { rows } = await query(
      `SELECT DISTINCT p.supplier_id, p.weight FROM promotions p
       WHERE p.is_active AND p.starts_at <= now() AND p.ends_at > now()
         AND (p.category_id IS NULL OR p.category_id = $1)
       ORDER BY p.weight DESC LIMIT 20`,
      [categoryId ?? null],
    );
    return rows.map((row) => ({ supplierId: Number(row.supplier_id), weight: row.weight }));
  }
}
