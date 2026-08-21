import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, adminId } from '../../utils/guard.js';
import { COMPLAINT_REASONS, SUBMISSION_TYPES } from '../../utils/constants.js';
import { SuppliersRepository } from '../suppliers/suppliers.repository.js';
import { SuppliersStatsRepository } from '../suppliers/suppliers.stats.repository.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { ModerationRepository } from './moderation.repository.js';
import { ModerationService } from './moderation.service.js';
import { SubmissionsApplier } from './submissions.applier.js';
import { QUEUE_NAMES } from './moderation.queues.js';

const stats = new SuppliersStatsRepository();
export const moderationRepository = new ModerationRepository();
export const moderationService = new ModerationService(
  moderationRepository,
  stats,
  new SubmissionsApplier(new SuppliersService(new SuppliersRepository(), stats)),
);

export const moderationRouter = Router();
moderationRouter.use(requireAuth);

const queueParam = z.object({ queue: z.enum(QUEUE_NAMES) });

const listSchema = z.object({
  status: z.string().trim().max(20).optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  type: z.enum(SUBMISSION_TYPES).optional(),
  reason: z.enum(COMPLAINT_REASONS).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

moderationRouter.get('/counts', async (req, res) => {
  res.json({ ok: true, data: await moderationService.counts() });
});

moderationRouter.get('/:queue', async (req, res) => {
  const { queue } = validate(queueParam, req.params);
  const { page, limit, ...filters } = validate(listSchema, req.query);
  res.json({ ok: true, data: await moderationService.list(queue, filters, { page, limit }) });
});

moderationRouter.post('/:queue/:id/resolve', async (req, res) => {
  const { queue } = validate(queueParam, req.params);
  const { id } = validate(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const data = validate(
    z.object({
      status: z.string().trim().min(2).max(20),
      resolution: z.string().trim().max(1000).optional(),
    }),
    req.body,
  );
  res.json({ ok: true, data: await moderationService.resolve(queue, id, data, adminId(req)) });
});
