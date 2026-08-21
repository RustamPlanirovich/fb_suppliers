import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { ValidationError } from '../../utils/errors.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { catalogService, variantsStatsRepository, aliasesRepository } from './catalog.container.js';
import * as schemas from './catalog.schemas.js';

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

catalogRouter.get('/products', async (req, res) => {
  const { page, limit, ...filters } = validate(schemas.productListSchema, req.query);
  res.json({ ok: true, data: await catalogService.listProducts(filters, { page, limit }) });
});

catalogRouter.post('/products', async (req, res) => {
  const data = validate(schemas.productSchema, req.body);
  res.status(201).json({ ok: true, data: await catalogService.createProduct(data, adminId(req)) });
});

catalogRouter.get('/products/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await catalogService.getProduct(id) });
});

catalogRouter.patch('/products/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const data = validate(schemas.productUpdateSchema, req.body);
  res.json({ ok: true, data: await catalogService.updateProduct(id, data, adminId(req)) });
});

catalogRouter.delete('/products/:id', requireRole('admin'), async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  await catalogService.removeProduct(id, adminId(req));
  res.json({ ok: true, data: null });
});

// Синонимы товара: по ним пользователь находит его, как бы ни написал.
catalogRouter.get('/products/:id/aliases', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await aliasesRepository.list(id) });
});

catalogRouter.post('/products/:id/aliases', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const { alias, source } = validate(
    z.object({
      alias: z.string().trim().min(2).max(120),
      source: z.enum(['manual', 'query']).optional(),
    }),
    req.body,
  );
  const created = await aliasesRepository.add(id, alias, source ?? 'manual', adminId(req));
  if (!created) throw new ValidationError('Слишком короткий синоним');
  res.status(201).json({ ok: true, data: created });
});

catalogRouter.delete('/aliases/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  if (!(await aliasesRepository.remove(id))) {
    throw new ValidationError('Синоним не найден или создан автоматически');
  }
  res.json({ ok: true, data: null });
});

// Пересборка автосинонимов для товаров, заведённых до появления словаря.
catalogRouter.post('/aliases/refresh', requireRole('admin'), async (req, res) => {
  res.json({ ok: true, data: await aliasesRepository.refreshAll() });
});

catalogRouter.get('/variants', async (req, res) => {
  const { page, limit, ...filters } = validate(schemas.variantListSchema, req.query);
  res.json({ ok: true, data: await catalogService.listVariants(filters, { page, limit }) });
});

catalogRouter.post('/variants', async (req, res) => {
  const data = validate(schemas.variantSchema, req.body);
  res.status(201).json({ ok: true, data: await catalogService.createVariant(data, adminId(req)) });
});

catalogRouter.get('/variants/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await catalogService.getVariant(id) });
});

catalogRouter.patch('/variants/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const data = validate(schemas.variantUpdateSchema, req.body);
  res.json({ ok: true, data: await catalogService.updateVariant(id, data, adminId(req)) });
});

catalogRouter.post('/variants/:id/refresh-stats', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await catalogService.refreshVariantStats(id) });
});

catalogRouter.post('/variants/refresh-stale', async (req, res) => {
  const ids = await variantsStatsRepository.staleIds(200);
  const refreshed = await variantsStatsRepository.refreshMany(ids);
  res.json({ ok: true, data: { refreshed: refreshed.length } });
});

catalogRouter.delete('/variants/:id', requireRole('admin'), async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  await catalogService.removeVariant(id, adminId(req));
  res.json({ ok: true, data: null });
});
