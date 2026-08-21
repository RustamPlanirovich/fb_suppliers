import { query } from '../../utils/db.js';

// Массовые операции админки. Всегда по явному списку id, ограниченному BULK_LIMIT.
export class SuppliersBulkRepository {
  async setStatus(ids, status) {
    const { rowCount } = await query(
      'UPDATE suppliers SET status = $2 WHERE id = ANY($1::bigint[])', [ids, status]);
    return rowCount;
  }

  async setCategory(ids, categoryId) {
    const { rowCount } = await query(
      'UPDATE suppliers SET category_id = $2 WHERE id = ANY($1::bigint[])', [ids, categoryId]);
    return rowCount;
  }

  async setHidden(ids, isHidden) {
    const { rowCount } = await query(
      'UPDATE suppliers SET is_hidden = $2 WHERE id = ANY($1::bigint[])', [ids, isHidden]);
    return rowCount;
  }

  async assignCheck(ids) {
    const { rowCount } = await query(
      "UPDATE suppliers SET status = 'recheck' WHERE id = ANY($1::bigint[])", [ids]);
    return rowCount;
  }

  async addTags(ids, tagIds) {
    const { rowCount } = await query(
      `INSERT INTO supplier_tags (supplier_id, tag_id)
       SELECT s.id, t.id FROM unnest($1::bigint[]) s(id) CROSS JOIN unnest($2::bigint[]) t(id)
       ON CONFLICT DO NOTHING`,
      [ids, tagIds],
    );
    return rowCount;
  }

  async remove(ids) {
    const { rowCount } = await query('DELETE FROM suppliers WHERE id = ANY($1::bigint[])', [ids]);
    return rowCount;
  }
}
