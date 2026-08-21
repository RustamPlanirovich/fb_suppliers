export const PROJECT = 'fpsuppliers';

export const BCRYPT_ROUNDS = 12;

export const ADMIN_ROLES = ['owner', 'admin', 'moderator'];

// Право на действие: минимальная роль. Владелец может всё.
export const ROLE_LEVEL = { moderator: 1, admin: 2, owner: 3 };

export const PAGE_SIZE = { DEFAULT: 25, MAX: 200 };

// Максимум записей в одной массовой операции админки.
export const BULK_LIMIT = 500;

export const BODY_LIMIT = '2mb';

export const RATE_LIMIT = {
  LOGIN: { windowMs: 15 * 60 * 1000, max: 10 },
  API: { windowMs: 60 * 1000, max: 300 },
};
