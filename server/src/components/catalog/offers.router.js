import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { offersService, marketRepository } from './catalog.container.js';
import * as schemas from './catalog.schemas.js';

export const offersRouter = Router();
offersRouter.use(requireAuth);

offersRouter.get('/', async (req, res) => {
  const { page, limit, ...filters } = validate(schemas.offerListSchema, req.query);
  res.json({ ok: true, data: await offersService.list(filters, { page, limit }) });
});

offersRouter.post('/', async (req, res) => {
  const data = validate(schemas.offerSchema, req.body);
  res.status(201).json({ ok: true, data: await offersService.create(data, adminId(req)) });
});

offersRouter.get('/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await offersService.getById(id) });
});

offersRouter.patch('/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const data = validate(schemas.offerUpdateSchema, req.body);
  res.json({ ok: true, data: await offersService.update(id, data, adminId(req)) });
});

offersRouter.post('/:id/price', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const data = validate(schemas.priceSchema, req.body);
  res.json({ ok: true, data: await offersService.setPrice(id, data, adminId(req)) });
});

offersRouter.get('/:id/history', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await offersService.history(id) });
});

offersRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  await offersService.remove(id, adminId(req));
  res.json({ ok: true, data: null });
});

// --- рыночные цены площадок ---
export const marketRouter = Router();
marketRouter.use(requireAuth);

marketRouter.get('/marketplaces', async (req, res) => {
  res.json({ ok: true, data: await marketRepository.listMarketplaces() });
});

marketRouter.put('/marketplaces', requireRole('admin'), async (req, res) => {
  const data = validate(schemas.marketplaceSchema, req.body);
  res.json({ ok: true, data: await marketRepository.upsertMarketplace(data) });
});

marketRouter.post('/snapshots', async (req, res) => {
  const data = validate(schemas.marketSnapshotSchema, req.body);
  res.status(201).json({ ok: true, data: await marketRepository.addSnapshot(data) });
});

marketRouter.get('/variants/:id/prices', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await marketRepository.latestByVariant(id) });
});

marketRouter.get('/variants/:id/series', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const { days, marketplaceId } = validate(
    z.object({
      days: z.coerce.number().int().positive().max(365).optional(),
      marketplaceId: z.coerce.number().int().positive(),
    }),
    req.query,
  );
  const buy = await offersService.variantSeries(id, days ?? 30);
  const sell = await marketRepository.series(id, marketplaceId, days ?? 30);
  res.json({ ok: true, data: { buy, sell } });
});
