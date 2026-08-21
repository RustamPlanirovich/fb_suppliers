import { query } from '../../utils/db.js';

// Разделы площадки, поставленные на синхронизацию.
export class SourceNodesRepository {
  async list() {
    const { rows } = await query(
      `SELECT n.*, m.code AS marketplace_code, p.name AS product_name
       FROM source_nodes n
       JOIN marketplaces m ON m.id = n.marketplace_id
       LEFT JOIN products p ON p.id = n.product_id
       ORDER BY n.created_at DESC`,
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM source_nodes WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async upsert(data) {
    const { rows } = await query(
      `INSERT INTO source_nodes (marketplace_id, node_id, url, game_name, node_name, product_id,
                                 category_id, variant_attrs, with_sellers, created_by, title_rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, TRUE), $10, $11)
       ON CONFLICT (marketplace_id, node_id) DO UPDATE SET
         url = excluded.url, game_name = excluded.game_name, node_name = excluded.node_name,
         product_id = excluded.product_id, category_id = excluded.category_id,
         variant_attrs = excluded.variant_attrs, with_sellers = excluded.with_sellers,
         title_rules = excluded.title_rules, is_active = TRUE
       RETURNING *`,
      [data.marketplaceId, data.nodeId, data.url, data.gameName ?? null, data.nodeName ?? null,
        data.productId ?? null, data.categoryId ?? null,
        JSON.stringify(data.variantAttrs ?? []), data.withSellers, data.createdBy ?? null,
        JSON.stringify(data.titleRules ?? [])],
    );
    return rows[0];
  }

  async setActive(id, isActive) {
    const { rows } = await query(
      'UPDATE source_nodes SET is_active = $2 WHERE id = $1 RETURNING *', [id, isActive]);
    return rows[0] ?? null;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM source_nodes WHERE id = $1', [id]);
    return rowCount > 0;
  }

  async saveResult(id, result) {
    await query(
      'UPDATE source_nodes SET last_synced_at = now(), last_result = $2 WHERE id = $1',
      [id, JSON.stringify(result)],
    );
  }

  // Разделы, которые пора обновить: по возрастанию давности синхронизации.
  async due(limit, staleHours) {
    const { rows } = await query(
      `SELECT * FROM source_nodes
       WHERE is_active
         AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(hours => $2))
       ORDER BY last_synced_at NULLS FIRST LIMIT $1`,
      [limit, staleHours],
    );
    return rows;
  }
}
