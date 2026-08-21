import { PAGE_SIZE } from './constants.js';

export function normalizePaging({ page, limit } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(PAGE_SIZE.MAX, Math.max(1, Number(limit) || PAGE_SIZE.DEFAULT));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

export function paged(rows, total, { page, limit }) {
  return {
    items: rows,
    total: Number(total),
    page,
    limit,
    pages: Math.max(1, Math.ceil(Number(total) / limit)),
  };
}
