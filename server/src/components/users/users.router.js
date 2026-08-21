import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, adminId } from '../../utils/guard.js';
import { writeAudit } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';
import { UsersRepository } from './users.repository.js';

export const usersRepository = new UsersRepository();

export const usersRouter = Router();
usersRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  isBlocked: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true),
    z.boolean().optional()),
  hasSubscription: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true),
    z.boolean().optional()),
  planCode: z.string().trim().max(40).optional(),
  createdFrom: z.coerce.date().optional(),
  activeSince: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

usersRouter.get('/', async (req, res) => {
  const { page, limit, ...filters } = validate(listSchema, req.query);
  const paging = normalizePaging({ page, limit });
  const { rows, total } = await usersRepository.list(filters, paging);
  res.json({ ok: true, data: paged(rows, total, paging) });
});

usersRouter.get('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const user = await usersRepository.findById(id);
  if (!user) throw new NotFoundError('Пользователь не найден');
  res.json({ ok: true, data: { ...user, favorites: await usersRepository.favorites(id) } });
});

usersRouter.post('/:id/block', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { isBlocked, note } = validate(
    z.object({ isBlocked: z.boolean(), note: z.string().trim().max(500).optional() }),
    req.body,
  );
  const user = await usersRepository.setBlocked(id, isBlocked, note);
  if (!user) throw new NotFoundError('Пользователь не найден');
  await writeAudit({ adminId: adminId(req), entity: 'bot_user', entityId: id, action: 'block',
    changes: { is_blocked: { to: isBlocked } }, comment: note ?? null });
  res.json({ ok: true, data: { id: user.id, is_blocked: user.is_blocked } });
});
