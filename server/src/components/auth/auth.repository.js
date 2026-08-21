import { query } from '../../utils/db.js';

export class AuthRepository {
  async findByEmail(email) {
    const { rows } = await query(
      'SELECT * FROM admins WHERE lower(email) = lower($1) LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id) {
    const { rows } = await query(
      'SELECT id, email, name, role, is_active FROM admins WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async create({ email, name, passwordHash, role }) {
    const { rows } = await query(
      `INSERT INTO admins (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at`,
      [email, name, passwordHash, role],
    );
    return rows[0];
  }

  async list() {
    const { rows } = await query(
      `SELECT id, email, name, role, is_active, last_login_at, created_at
       FROM admins ORDER BY created_at`,
    );
    return rows;
  }

  async updatePassword(id, passwordHash) {
    await query('UPDATE admins SET password_hash = $2, updated_at = now() WHERE id = $1',
      [id, passwordHash]);
  }

  async setActive(id, isActive) {
    const { rows } = await query(
      `UPDATE admins SET is_active = $2, updated_at = now() WHERE id = $1
       RETURNING id, email, name, role, is_active`,
      [id, isActive],
    );
    return rows[0] ?? null;
  }

  async touchLogin(id) {
    await query('UPDATE admins SET last_login_at = now() WHERE id = $1', [id]);
  }

  async count() {
    const { rows } = await query('SELECT count(*)::int AS total FROM admins');
    return rows[0].total;
  }
}
