import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { NotFoundError } from '../../utils/errors.js';
import { marketRepository } from '../catalog/catalog.container.js';
import { PROVIDER_CODES, providerList } from './providers/index.js';
import { sourceSyncService, sourceNodesRepository, shopsService } from './sources.container.js';

export const sourcesRouter = Router();
sourcesRouter.use(requireAuth, requireRole('admin'));

const idParam = z.object({ id: z.coerce.number().int().positive() });
const providerParam = z.object({ provider: z.enum(PROVIDER_CODES) });

const nodeSchema = z.object({
  nodeId: z.string().trim().min(1).max(120),
  kind: z.string().trim().max(20).optional(),
  url: z.string().trim().url().max(500).optional(),
  productName: z.string().trim().min(2).max(200),
  categoryId: z.coerce.number().int().positive().optional(),
  gameName: z.string().trim().max(200).optional(),
  nodeName: z.string().trim().max(200).optional(),
  variantAttrs: z.array(z.string().trim().max(40)).max(5).optional(),
  titleRules: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    contains: z.string().trim().min(1).max(200),
  })).max(30).optional(),
  withSellers: z.boolean().optional(),
  sellerStatus: z.enum(['draft', 'pending', 'verified']).optional(),
});

// Список подключённых источников: админка строит по нему переключатель площадок.
sourcesRouter.get('/', (req, res) => {
  res.json({ ok: true, data: providerList() });
});

sourcesRouter.get('/:provider/games', async (req, res) => {
  const { provider } = validate(providerParam, req.params);
  const params = validate(
    z.object({
      q: z.string().trim().max(120).optional(),
      refresh: z.preprocess((value) => value === 'true' || value === true, z.boolean().optional()),
    }),
    req.query,
  );
  res.json({ ok: true, data: await sourceSyncService.games(provider, params) });
});

sourcesRouter.post('/:provider/preview', async (req, res) => {
  const { provider } = validate(providerParam, req.params);
  const data = validate(nodeSchema.partial({ productName: true }), req.body);
  res.json({ ok: true, data: await sourceSyncService.preview(provider, data) });
});

sourcesRouter.post('/:provider/sync', async (req, res) => {
  const { provider } = validate(providerParam, req.params);
  const data = validate(nodeSchema, req.body);
  res.json({ ok: true, data: await sourceSyncService.sync(provider, data, adminId(req)) });
});

sourcesRouter.post('/:provider/sync-batch', async (req, res) => {
  const { provider } = validate(providerParam, req.params);
  const { nodes } = validate(z.object({ nodes: z.array(nodeSchema).min(1).max(20) }), req.body);
  res.json({ ok: true, data: await sourceSyncService.syncMany(provider, nodes, adminId(req)) });
});

// Массовое подключение магазинов: список ссылок или ID одним действием.
sourcesRouter.post('/:provider/shops', async (req, res) => {
  const { provider } = validate(providerParam, req.params);
  const data = validate(
    z.object({
      items: z.array(z.string().trim().min(1).max(300)).min(1).max(50),
      sellerStatus: z.enum(['draft', 'pending', 'verified']).optional(),
      titleRules: z.array(z.object({
        name: z.string().trim().min(1).max(80),
        contains: z.string().trim().min(1).max(200),
      })).max(30).optional(),
      save: z.boolean().optional(),
    }),
    req.body,
  );
  res.json({ ok: true, data: await shopsService.connect(provider, data, adminId(req)) });
});

// --- разделы, поставленные на регулярное обновление ---
sourcesRouter.get('/saved/list', async (req, res) => {
  res.json({ ok: true, data: await sourceNodesRepository.list() });
});

sourcesRouter.post('/:provider/saved', async (req, res) => {
  const { provider } = validate(providerParam, req.params);
  const data = validate(nodeSchema.extend({
    productId: z.coerce.number().int().positive().optional(),
  }), req.body);
  const marketplace = await marketRepository.findMarketplace(provider);
  if (!marketplace) throw new NotFoundError(`Площадка «${provider}» не заведена в справочнике`);
  const source = await sourceNodesRepository.upsert({
    ...data,
    marketplaceId: marketplace.id,
    url: data.url ?? sourceSyncService.provider(provider).nodeUrl(data.nodeId, data.kind),
    createdBy: adminId(req),
  });
  res.status(201).json({ ok: true, data: source });
});

sourcesRouter.post('/saved/:id/sync', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const source = await sourceNodesRepository.findById(id);
  if (!source) throw new NotFoundError('Раздел не найден');
  const provider = await marketRepository.findMarketplaceById(source.marketplace_id);
  const result = await sourceSyncService.sync(provider.code, {
    nodeId: source.node_id,
    url: source.url,
    productName: source.node_name ? `${source.game_name} ${source.node_name}` : source.game_name,
    categoryId: source.category_id ?? undefined,
    gameName: source.game_name,
    nodeName: source.node_name,
    variantAttrs: source.variant_attrs ?? [],
    titleRules: source.title_rules ?? [],
    withSellers: source.with_sellers,
  }, adminId(req));
  await sourceNodesRepository.saveResult(id, { ...result, groups: undefined });
  res.json({ ok: true, data: result });
});

sourcesRouter.post('/saved/:id/active', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { isActive } = validate(z.object({ isActive: z.boolean() }), req.body);
  const source = await sourceNodesRepository.setActive(id, isActive);
  if (!source) throw new NotFoundError('Раздел не найден');
  res.json({ ok: true, data: source });
});

sourcesRouter.delete('/saved/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  if (!(await sourceNodesRepository.remove(id))) throw new NotFoundError('Раздел не найден');
  res.json({ ok: true, data: null });
});
