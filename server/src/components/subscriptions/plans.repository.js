import { query } from '../../utils/db.js';

export class PlansRepository {
  async all(activeOnly = false) {
    const { rows } = await query(
      `SELECT * FROM plans ${activeOnly ? 'WHERE is_active' : ''} ORDER BY sort_order, price`,
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM plans WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async findByCode(code) {
    const { rows } = await query('SELECT * FROM plans WHERE code = $1', [code]);
    return rows[0] ?? null;
  }

  async findDefault() {
    const { rows } = await query('SELECT * FROM plans WHERE is_default LIMIT 1');
    return rows[0] ?? null;
  }

  async create(data) {
    const { rows } = await query(
      `INSERT INTO plans (code, name, description, price, currency, days, features, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, TRUE)) RETURNING *`,
      [data.code, data.name, data.description ?? null, data.price ?? 0, data.currency ?? 'RUB',
        data.days ?? 30, JSON.stringify(data.features ?? {}), data.sortOrder ?? 0, data.isActive],
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await query(
      `UPDATE plans SET
         name = coalesce($2, name),
         description = coalesce($3, description),
         price = coalesce($4, price),
         days = coalesce($5, days),
         features = coalesce($6, features),
         sort_order = coalesce($7, sort_order),
         is_active = coalesce($8, is_active),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, data.name ?? null, data.description ?? null, data.price ?? null, data.days ?? null,
        data.features ? JSON.stringify(data.features) : null, data.sortOrder ?? null,
        data.isActive ?? null],
    );
    return rows[0] ?? null;
  }

  // Тариф по умолчанию ровно один: снимаем флаг со всех и ставим выбранному.
  async setDefault(id) {
    await query('UPDATE plans SET is_default = FALSE WHERE is_default');
    const { rows } = await query('UPDATE plans SET is_default = TRUE WHERE id = $1 RETURNING *', [id]);
    return rows[0] ?? null;
  }

  async remove(id) {
    const { rowCount } = await query('DELETE FROM plans WHERE id = $1 AND NOT is_default', [id]);
    return rowCount > 0;
  }
}
