import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../utils/constants.js';
import { AuthError, ValidationError, NotFoundError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';

export class AuthService {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async login({ email, password }) {
    const admin = await this.#repo.findByEmail(email);
    const ok = admin && (await bcrypt.compare(password, admin.password_hash));
    if (!ok) throw new AuthError('Неверный email или пароль');
    if (!admin.is_active) throw new AuthError('Учётная запись отключена');
    await this.#repo.touchLogin(admin.id);
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  }

  async list() {
    return this.#repo.list();
  }

  async create({ email, name, password, role }, actorId) {
    if (await this.#repo.findByEmail(email)) throw new ValidationError('Email уже занят');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const admin = await this.#repo.create({ email, name, passwordHash, role });
    await writeAudit({ adminId: actorId, entity: 'admin', entityId: admin.id, action: 'create',
      changes: { email, role } });
    return admin;
  }

  // Первый администратор создаётся без входа в систему — только пока таблица пуста.
  async bootstrap({ email, name, password }) {
    if (await this.#repo.count()) throw new ValidationError('Администраторы уже созданы');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.#repo.create({ email, name, passwordHash, role: 'owner' });
  }

  async changePassword({ id, currentPassword, newPassword }) {
    const admin = await this.#repo.findByEmail((await this.#requireById(id)).email);
    if (!(await bcrypt.compare(currentPassword, admin.password_hash))) {
      throw new AuthError('Текущий пароль неверен');
    }
    await this.#repo.updatePassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
  }

  async resetPassword({ id, newPassword }, actorId) {
    await this.#requireById(id);
    await this.#repo.updatePassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    await writeAudit({ adminId: actorId, entity: 'admin', entityId: id, action: 'reset_password' });
  }

  async setActive(id, isActive, actorId) {
    const admin = await this.#repo.setActive(id, isActive);
    if (!admin) throw new NotFoundError('Администратор не найден');
    await writeAudit({ adminId: actorId, entity: 'admin', entityId: id, action: 'set_active',
      changes: { is_active: { to: isActive } } });
    return admin;
  }

  async #requireById(id) {
    const admin = await this.#repo.findById(id);
    if (!admin) throw new NotFoundError('Администратор не найден');
    return admin;
  }
}
