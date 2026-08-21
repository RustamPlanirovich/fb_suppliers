import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { PLAN_FEATURE_KEYS, PLAN_FEATURES } from '../../utils/constants.js';
import { subscriptionsService } from './subscriptions.container.js';

export const subscriptionsRouter = Router();
subscriptionsRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Гибкие тарифы: админ сам собирает набор возможностей из известного словаря.
const featuresSchema = z.record(z.enum(PLAN_FEATURE_KEYS), z.union([z.boolean(), z.number()]));

const planSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  days: z.coerce.number().int().positive().max(36500).optional(),
  features: featuresSchema.optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

subscriptionsRouter.get('/features', (req, res) => {
  res.json({ ok: true, data: PLAN_FEATURES });
});

subscriptionsRouter.get('/plans', async (req, res) => {
  res.json({ ok: true, data: await subscriptionsService.listPlans(false) });
});

subscriptionsRouter.post('/plans', requireRole('admin'), async (req, res) => {
  const data = validate(planSchema, req.body);
  res.status(201).json({ ok: true, data: await subscriptionsService.createPlan(data, adminId(req)) });
});

subscriptionsRouter.patch('/plans/:id', requireRole('admin'), async (req, res) => {
  const { id } = validate(idParam, req.params);
  const data = validate(planSchema.partial().omit({ code: true }), req.body);
  res.json({ ok: true, data: await subscriptionsService.updatePlan(id, data, adminId(req)) });
});

subscriptionsRouter.post('/plans/:id/default', requireRole('admin'), async (req, res) => {
  const { id } = validate(idParam, req.params);
  res.json({ ok: true, data: await subscriptionsService.setDefaultPlan(id, adminId(req)) });
});

subscriptionsRouter.delete('/plans/:id', requireRole('admin'), async (req, res) => {
  const { id } = validate(idParam, req.params);
  await subscriptionsService.removePlan(id, adminId(req));
  res.json({ ok: true, data: null });
});

subscriptionsRouter.post('/grant', async (req, res) => {
  const data = validate(
    z.object({
      userId: z.coerce.number().int().positive(),
      planId: z.coerce.number().int().positive(),
      days: z.coerce.number().int().positive().max(3650).optional(),
      comment: z.string().trim().max(500).optional(),
    }),
    req.body,
  );
  res.json({ ok: true, data: await subscriptionsService.grant(data, adminId(req)) });
});

subscriptionsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = validate(idParam, req.params);
  res.json({ ok: true, data: await subscriptionsService.cancel(id, adminId(req)) });
});

subscriptionsRouter.get('/users/:id/history', async (req, res) => {
  const { id } = validate(idParam, req.params);
  res.json({ ok: true, data: await subscriptionsService.history(id) });
});

subscriptionsRouter.get('/payments', async (req, res) => {
  const { page, limit, ...filters } = validate(
    z.object({
      userId: z.coerce.number().int().positive().optional(),
      status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
      from: z.coerce.date().optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    }),
    req.query,
  );
  res.json({ ok: true, data: await subscriptionsService.listPayments(filters, { page, limit }) });
});

subscriptionsRouter.post('/payments', async (req, res) => {
  const data = validate(
    z.object({
      userId: z.coerce.number().int().positive(),
      planId: z.coerce.number().int().positive().optional(),
      amount: z.coerce.number().min(0),
      currency: z.string().trim().length(3).optional(),
      status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
      provider: z.string().trim().max(40).optional(),
      externalId: z.string().trim().max(120).optional(),
    }),
    req.body,
  );
  res.status(201).json({ ok: true, data: await subscriptionsService.registerPayment(data, adminId(req)) });
});

subscriptionsRouter.get('/promocodes', async (req, res) => {
  res.json({ ok: true, data: await subscriptionsService.listPromoCodes() });
});

subscriptionsRouter.post('/promocodes', async (req, res) => {
  const data = validate(
    z.object({
      code: z.string().trim().min(3).max(40),
      planId: z.coerce.number().int().positive().optional().nullable(),
      discountPct: z.coerce.number().min(0).max(100).optional(),
      bonusDays: z.coerce.number().int().min(0).max(3650).optional(),
      maxUses: z.coerce.number().int().positive().optional().nullable(),
      expiresAt: z.coerce.date().optional().nullable(),
    }),
    req.body,
  );
  res.status(201).json({ ok: true, data: await subscriptionsService.createPromoCode(data, adminId(req)) });
});

subscriptionsRouter.post('/promocodes/:id/active', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { isActive } = validate(z.object({ isActive: z.boolean() }), req.body);
  res.json({ ok: true, data: await subscriptionsService.setPromoActive(id, isActive, adminId(req)) });
});
