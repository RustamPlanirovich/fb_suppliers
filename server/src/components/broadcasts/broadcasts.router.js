import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { usersRepository } from '../users/users.router.js';
import { telegramSender } from '../bot/telegram.sender.js';
import { BroadcastsRepository } from './broadcasts.repository.js';
import { BroadcastsService } from './broadcasts.service.js';

export const broadcastsRepository = new BroadcastsRepository();
export const broadcastsService = new BroadcastsService(
  broadcastsRepository, usersRepository, telegramSender,
);

export const broadcastsRouter = Router();
broadcastsRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

const segmentSchema = z.object({
  planCode: z.string().trim().max(40).optional(),
  hasSubscription: z.boolean().optional(),
  activeSince: z.coerce.date().optional(),
  createdFrom: z.coerce.date().optional(),
});

const bodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(4000),
  mediaUrl: z.string().trim().url().max(500).optional().nullable(),
  buttons: z.array(z.object({
    text: z.string().trim().min(1).max(60),
    url: z.string().trim().url().max(500),
  })).max(6).optional(),
  segment: segmentSchema.optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
});

broadcastsRouter.get('/', async (req, res) => {
  const paging = validate(
    z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    }),
    req.query,
  );
  res.json({ ok: true, data: await broadcastsService.list(paging) });
});

broadcastsRouter.post('/', async (req, res) => {
  const data = validate(bodySchema, req.body);
  res.status(201).json({ ok: true, data: await broadcastsService.create(data, adminId(req)) });
});

broadcastsRouter.patch('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const data = validate(bodySchema.partial(), req.body);
  res.json({ ok: true, data: await broadcastsService.update(id, data, adminId(req)) });
});

broadcastsRouter.get('/:id/estimate', async (req, res) => {
  const { id } = validate(idParam, req.params);
  res.json({ ok: true, data: await broadcastsService.estimate(id) });
});

broadcastsRouter.post('/:id/test', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { telegramId } = validate(
    z.object({ telegramId: z.coerce.number().int().positive() }), req.body);
  res.json({ ok: true, data: await broadcastsService.testSend(id, telegramId) });
});

broadcastsRouter.post('/:id/schedule', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { scheduledAt } = validate(z.object({ scheduledAt: z.coerce.date() }), req.body);
  res.json({ ok: true, data: await broadcastsService.schedule(id, scheduledAt, adminId(req)) });
});

// Запуск требует роли admin и явного подтверждения охвата.
broadcastsRouter.post('/:id/start', requireRole('admin'), async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { confirmedTotal } = validate(
    z.object({ confirmedTotal: z.coerce.number().int().min(0).optional() }), req.body);
  res.json({ ok: true, data: await broadcastsService.start(id, { confirmedTotal }, adminId(req)) });
});

broadcastsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = validate(idParam, req.params);
  res.json({ ok: true, data: await broadcastsService.cancel(id, adminId(req)) });
});

broadcastsRouter.get('/:id/stats', async (req, res) => {
  const { id } = validate(idParam, req.params);
  res.json({ ok: true, data: await broadcastsRepository.refreshCounters(id) });
});
