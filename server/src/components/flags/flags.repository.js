import { query } from '../../utils/db.js';
import { SqlBuilder } from '../../utils/sql.js';

export class FlagsRepository {
  // Один открытый флаг на пару (сущность, тип): повторное срабатывание обновляет детали.
  async raise({ entity, entityId, type, severity, details }) {
    const { rows } = await query(
      `INSERT INTO data_flags (entity, entity_id, type, severity, details)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity, entity_id, type) WHERE status = 'open'
       DO UPDATE SET details = excluded.details, severity = excluded.severity
       RETURNING *`,
      [entity, entityId, type, severity ?? 'warning', JSON.stringify(details ?? {})],
    );
    return rows[0];
  }

  async list(filters, paging) {
    const builder = new SqlBuilder();
    builder
      .whereIf(filters.status, 'f.status = ?')
      .whereIf(filters.type, 'f.type = ANY(?)', filters.type)
      .whereIf(filters.entity, 'f.entity = ?')
      .whereIf(filters.severity, 'f.severity = ?');
    const limit = builder.param(paging.limit);
    const offset = builder.param(paging.offset);
    const { rows } = await query(
      `SELECT f.*, count(*) OVER () AS total_count FROM data_flags f
       ${builder.clause} ORDER BY
         CASE f.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
         f.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      builder.params,
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  }

  async summary() {
    const { rows } = await query(
      `SELECT type, severity, count(*)::int AS count FROM data_flags
       WHERE status = 'open' GROUP BY type, severity ORDER BY count DESC`,
    );
    return rows;
  }

  async resolve(ids, status, adminId) {
    const { rowCount } = await query(
      `UPDATE data_flags SET status = $2, resolved_by = $3, resolved_at = now()
       WHERE id = ANY($1::bigint[]) AND status = 'open'`,
      [ids, status, adminId],
    );
    return rowCount;
  }

  async closeFor(entity, entityId, type) {
    await query(
      `UPDATE data_flags SET status = 'resolved', resolved_at = now()
       WHERE entity = $1 AND entity_id = $2 AND type = $3 AND status = 'open'`,
      [entity, entityId, type],
    );
  }
}
