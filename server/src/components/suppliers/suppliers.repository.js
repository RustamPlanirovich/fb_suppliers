import { query } from '../../utils/db.js';
import { SqlBuilder, orderBy } from '../../utils/sql.js';
import { EDITABLE_FIELDS, SUPPLIER_COLUMNS, SUPPLIER_RETURNING } from './suppliers.fields.js';

const LIST_ORDER = {
  created: 's.created_at DESC',
  name: 's.name ASC',
  reliability: 's.score_reliability DESC NULLS LAST',
  reviews: 's.reviews_count DESC',
  quality: 's.quality_score DESC NULLS LAST',
  deals: 's.confirmed_deals_30d DESC',
  complaints: 's.complaints_count DESC',
  checked: 's.checked_at ASC NULLS FIRST',
};

export class SuppliersRepository {
  async findById(id) {
    const { rows } = await query(
      `SELECT ${SUPPLIER_COLUMNS}, c.name AS category_name
       FROM suppliers s LEFT JOIN categories c ON c.id = s.category_id
       WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(filters, paging) {
    const builder = this.#conditions(filters);
    const order = orderBy(LIST_ORDER, filters.sort, 'created');
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT ${SUPPLIER_COLUMNS}, c.name AS category_name, count(*) OVER () AS total_count
       FROM suppliers s LEFT JOIN categories c ON c.id = s.category_id
       ${builder.clause}
       ORDER BY ${order}
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async listIds(filters) {
    const builder = this.#conditions(filters);
    const { rows } = await query(`SELECT s.id FROM suppliers s ${builder.clause}`, builder.params);
    return rows.map((row) => Number(row.id));
  }

  #conditions(filters) {
    const builder = new SqlBuilder().where('s.merged_into_id IS NULL');
    builder
      .whereIf(filters.status, 's.status = ANY(?)', filters.status)
      .whereIf(filters.source, 's.source = ANY(?)', filters.source)
      .whereIf(filters.categoryId, 's.category_id = ?')
      .whereIf(filters.qualityMin, 's.quality_score >= ?')
      .whereIf(filters.reliabilityMin, 's.score_reliability >= ?')
      .whereIf(filters.createdFrom, 's.created_at >= ?')
      .whereIf(filters.createdTo, 's.created_at < ?');

    if (typeof filters.isHidden === 'boolean') builder.where('s.is_hidden = ?', filters.isHidden);
    if (filters.needsCheck) builder.where("s.status IN ('pending', 'recheck')");
    if (filters.staleCheckDays) {
      builder.where('(s.checked_at IS NULL OR s.checked_at < now() - make_interval(days => ?))',
        filters.staleCheckDays);
    }
    if (filters.tagIds?.length) {
      builder.where(
        'EXISTS (SELECT 1 FROM supplier_tags st WHERE st.supplier_id = s.id AND st.tag_id = ANY(?))',
        filters.tagIds,
      );
    }
    if (filters.variantId) {
      builder.where('EXISTS (SELECT 1 FROM offers o WHERE o.supplier_id = s.id AND o.variant_id = ?)',
        filters.variantId);
    }
    if (filters.q) {
      builder.where(
        `(s.name ILIKE ? OR s.telegram ILIKE ? OR s.phone ILIKE ? OR s.email ILIKE ?
          OR s.website ILIKE ?
          OR EXISTS (SELECT 1 FROM offers o WHERE o.supplier_id = s.id AND o.title ILIKE ?))`,
        ...Array(6).fill(`%${filters.q}%`),
      );
    }
    return builder;
  }

  async create(data) {
    const fields = EDITABLE_FIELDS.filter((field) => data[field] !== undefined);
    const columns = ['source', ...fields];
    const values = [data.source ?? 'manual', ...fields.map((field) => data[field])];
    const { rows } = await query(
      `INSERT INTO suppliers (${columns.join(', ')})
       VALUES (${values.map((value, index) => `$${index + 1}`).join(', ')})
       RETURNING ${SUPPLIER_RETURNING}`,
      values,
    );
    return rows[0];
  }

  async update(id, data) {
    const fields = EDITABLE_FIELDS.filter((field) => data[field] !== undefined);
    if (!fields.length) return this.findById(id);
    const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
    const { rows } = await query(
      `UPDATE suppliers SET ${assignments.join(', ')} WHERE id = $1 RETURNING ${SUPPLIER_RETURNING}`,
      [id, ...fields.map((field) => data[field])],
    );
    return rows[0] ?? null;
  }

  async markChecked(id, checkedBy, status) {
    const { rows } = await query(
      `UPDATE suppliers SET status = $3, checked_at = now(), checked_by = $2
       WHERE id = $1 RETURNING ${SUPPLIER_RETURNING}`,
      [id, checkedBy, status],
    );
    return rows[0] ?? null;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM suppliers WHERE id = $1', [id]);
    return rowCount > 0;
  }

  async findByExternal(source, externalId) {
    const { rows } = await query(
      'SELECT id FROM suppliers WHERE source = $1 AND external_id = $2',
      [source, externalId],
    );
    return rows[0] ?? null;
  }

  // Карточка продавца площадки: контакты не сохраняются, статистика источника — отдельно.
  async upsertMarketplaceSeller({ source, externalId, name, url, rating, reviewsCount, stats, status }) {
    const { rows } = await query(
      // Статус выставляется только при создании: решение администратора о проверке
      // не должно откатываться следующей синхронизацией.
      `INSERT INTO suppliers (source, external_id, name, external_url, status,
                              source_rating, source_reviews_count, source_stats, source_synced_at)
       VALUES ($1, $2, $3, $4, $8, $5, $6, $7, now())
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
         name = excluded.name,
         external_url = coalesce(excluded.external_url, suppliers.external_url),
         source_rating = excluded.source_rating,
         source_reviews_count = excluded.source_reviews_count,
         source_stats = suppliers.source_stats || excluded.source_stats,
         source_synced_at = now()
       RETURNING id, name, status, (xmax = 0) AS inserted`,
      [source, String(externalId), name, url ?? null, rating ?? null, reviewsCount ?? null,
        JSON.stringify(stats ?? {}), status ?? 'pending'],
    );
    return rows[0];
  }

  async tags(supplierId) {
    const { rows } = await query(
      `SELECT t.id, t.name, t.slug, t.color FROM tags t
       JOIN supplier_tags st ON st.tag_id = t.id WHERE st.supplier_id = $1 ORDER BY t.name`,
      [supplierId],
    );
    return rows;
  }

  async setTags(supplierId, tagIds, client = null) {
    const run = client ? client.query.bind(client) : query;
    await run('DELETE FROM supplier_tags WHERE supplier_id = $1', [supplierId]);
    if (tagIds.length) {
      await run(
        `INSERT INTO supplier_tags (supplier_id, tag_id)
         SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`,
        [supplierId, tagIds],
      );
    }
  }
}
