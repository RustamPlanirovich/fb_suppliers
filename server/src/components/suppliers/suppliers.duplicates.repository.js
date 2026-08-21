import { query } from '../../utils/db.js';

// Поиск дублей по нормализованным контактам и названию.
const GROUPS = {
  phone: 'regexp_replace(coalesce(phone, \'\'), \'\\D\', \'\', \'g\')',
  telegram: 'lower(coalesce(telegram, \'\'))',
  website: "lower(regexp_replace(coalesce(website, ''), '^https?://(www\\.)?', ''))",
  email: 'lower(coalesce(email, \'\'))',
  name: 'lower(btrim(name))',
};

export class SuppliersDuplicatesRepository {
  // field приходит только из белого списка GROUPS — в SQL не попадают внешние строки.
  async groups(field, limit) {
    const expression = GROUPS[field];
    if (!expression) return [];
    const { rows } = await query(
      `SELECT ${expression} AS key,
              count(*)::int AS count,
              json_agg(json_build_object(
                'id', id, 'name', name, 'status', status, 'source', source,
                'created_at', created_at) ORDER BY created_at) AS items
       FROM suppliers
       WHERE merged_into_id IS NULL AND ${expression} <> ''
       GROUP BY 1 HAVING count(*) > 1
       ORDER BY count DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({ field, ...row }));
  }

  async merge(targetId, sourceId, client) {
    await client.query(
      `UPDATE offers o SET supplier_id = $1
       WHERE o.supplier_id = $2
         AND NOT EXISTS (SELECT 1 FROM offers x WHERE x.supplier_id = $1 AND x.variant_id = o.variant_id)`,
      [targetId, sourceId],
    );
    await client.query('DELETE FROM offers WHERE supplier_id = $1', [sourceId]);

    for (const table of ['reviews', 'complaints', 'deal_confirmations', 'promotions', 'submissions']) {
      await client.query(`UPDATE ${table} SET supplier_id = $1 WHERE supplier_id = $2`,
        [targetId, sourceId]);
    }
    await client.query(
      `UPDATE favorites f SET supplier_id = $1 WHERE supplier_id = $2
         AND NOT EXISTS (SELECT 1 FROM favorites x WHERE x.user_id = f.user_id AND x.supplier_id = $1)`,
      [targetId, sourceId],
    );
    await client.query('DELETE FROM favorites WHERE supplier_id = $1', [sourceId]);
    await client.query(
      `INSERT INTO supplier_tags (supplier_id, tag_id)
       SELECT $1, tag_id FROM supplier_tags WHERE supplier_id = $2 ON CONFLICT DO NOTHING`,
      [targetId, sourceId],
    );
    await client.query(
      "UPDATE suppliers SET merged_into_id = $1, status = 'archived', is_hidden = TRUE WHERE id = $2",
      [targetId, sourceId],
    );
  }
}
