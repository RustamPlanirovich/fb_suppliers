import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, adminId } from '../../utils/guard.js';
import { ARBITRAGE_MARKS } from '../../utils/constants.js';
import { ArbitrageRepository } from './arbitrage.repository.js';
import { ArbitrageService } from './arbitrage.service.js';

export const arbitrageRepository = new ArbitrageRepository();
export const arbitrageService = new ArbitrageService(arbitrageRepository);

export const arbitrageRouter = Router();
arbitrageRouter.use(requireAuth);

const listSchema = z.object({
  roiMin: z.coerce.number().optional(),
  profitMin: z.coerce.number().optional(),
  buyMax: z.coerce.number().optional(),
  variantId: z.coerce.number().int().positive().optional(),
  marketplaceId: z.coerce.number().int().positive().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  competition: z.enum(['low', 'medium', 'high']).optional(),
  adminMark: z.enum(ARBITRAGE_MARKS).optional(),
  sort: z.enum(['roi', 'profit', 'margin', 'fresh']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

arbitrageRouter.get('/', async (req, res) => {
  const { page, limit, ...filters } = validate(listSchema, req.query);
  res.json({ ok: true, data: await arbitrageService.list(filters, { page, limit }) });
});

arbitrageRouter.post('/recompute', async (req, res) => {
  res.json({ ok: true, data: await arbitrageService.recompute() });
});

arbitrageRouter.post('/:id/mark', async (req, res) => {
  const { id } = validate(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const data = validate(
    z.object({ mark: z.enum(ARBITRAGE_MARKS), note: z.string().trim().max(500).optional() }),
    req.body,
  );
  res.json({ ok: true, data: await arbitrageService.setMark(id, data, adminId(req)) });
});
