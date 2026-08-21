// Проверка сессии админки и уровня роли. Ставится перед роутерами админки.
import { AuthError, AppError } from './errors.js';
import { ROLE_LEVEL } from './constants.js';

export function requireAuth(req, res, next) {
  if (!req.session?.admin) throw new AuthError('Требуется вход в админку');
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    const current = ROLE_LEVEL[req.session?.admin?.role] ?? 0;
    if (current < (ROLE_LEVEL[role] ?? 99)) {
      throw new AppError('Недостаточно прав', { status: 403, code: 'FORBIDDEN' });
    }
    next();
  };
}

export const adminId = (req) => req.session?.admin?.id ?? null;
