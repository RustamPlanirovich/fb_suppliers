import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { NotFoundError } from '../../utils/errors.js';
import { marketRepository } from '../catalog/catalog.container.js';
import {
  funpayCatalogService, funpaySyncService, sourceNodesRepository, funpayClient, funpayUserParser,
} from './funpay.container.js';

export const funpayRouter = Router();
funpayRouter.use(requireAuth, requireRole('admin'));

const idParam = z.object({ id: z.coerce.number().int().positive() });

const nodeSchema = z.object({
  nodeId: z.string().trim().regex(/^\d+$/),
  kind: z.enum(['lots', 'chips']).optional(),
  url: z.string().trim().url().max(500).optional(),
  productName: z.string().trim().min(2).max(200),
  categoryId: z.coerce.number().int().positive().optional(),
  // Название игры и раздела площадки: из них строится дерево категорий для бота.
  gameName: z.string().trim().max(200).optional(),
  nodeName: z.string().trim().max(200).optional(),
  variantAttrs: z.array(z.string().trim().max(40)).max(5).optional(),
  // Разбиение по названию для разделов без фильтров: [{ name, contains }].
  titleRules: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    contains: z.string().trim().min(1).max(200),
  })).max(30).optional(),
  withSellers: z.boolean().optional(),
  // Статус создаваемых карточек: по умолчанию «на проверке» — их разбирают в очереди.
  sellerStatus: z.enum(['draft', 'pending', 'verified']).optional(),
});

// --- каталог площадки: игры и разделы ---
funpayRouter.get('/games', async (req, res) => {
  const { q, refresh } = validate(
    z.object({
      q: z.string().trim().max(80).optional(),
      refresh: z.preprocess((value) => value === 'true' || value === true, z.boolean().optional()),
    }),
    req.query,
  );
  const games = refresh
    ? await funpayCatalogService.games({ refresh: true })
    : await funpayCatalogService.search(q, 40);
  res.json({ ok: true, data: games });
});

funpayRouter.get('/nodes/:nodeId', async (req, res) => {
  const { nodeId } = validate(z.object({ nodeId: z.string().regex(/^\d+$/) }), req.params);
  res.json({ ok: true, data: await funpayCatalogService.findNode(nodeId) });
});

// --- предпросмотр и синхронизация ---
funpayRouter.post('/preview', async (req, res) => {
  const data = validate(
    nodeSchema.partial({ productName: true }).required({ nodeId: true }), req.body);
  res.json({ ok: true, data: await funpaySyncService.preview(data) });
});

funpayRouter.post('/sync', async (req, res) => {
  const data = validate(nodeSchema, req.body);
  res.json({ ok: true, data: await funpaySyncService.syncNode(data, adminId(req)) });
});

funpayRouter.post('/sync-batch', async (req, res) => {
  const { nodes } = validate(z.object({ nodes: z.array(nodeSchema).min(1).max(20) }), req.body);
  res.json({ ok: true, data: await funpaySyncService.syncMany(nodes, adminId(req)) });
});

// --- сохранённые разделы на регулярную синхронизацию ---
funpayRouter.get('/sources', async (req, res) => {
  res.json({ ok: true, data: await sourceNodesRepository.list() });
});

funpayRouter.post('/sources', async (req, res) => {
  const data = validate(
    nodeSchema.extend({ productId: z.coerce.number().int().positive().optional() }),
    req.body,
  );
  const marketplace = await marketRepository.findMarketplace('funpay');
  if (!marketplace) throw new NotFoundError('Площадка funpay не заведена в справочнике');
  const source = await sourceNodesRepository.upsert({
    ...data,
    marketplaceId: marketplace.id,
    url: data.url ?? funpayClient.nodeUrl(data.nodeId, data.kind),
    createdBy: adminId(req),
  });
  res.status(201).json({ ok: true, data: source });
});

funpayRouter.post('/sources/:id/sync', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const source = await sourceNodesRepository.findById(id);
  if (!source) throw new NotFoundError('Раздел не найден');
  const result = await funpaySyncService.syncNode({
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

funpayRouter.post('/sources/:id/active', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { isActive } = validate(z.object({ isActive: z.boolean() }), req.body);
  const source = await sourceNodesRepository.setActive(id, isActive);
  if (!source) throw new NotFoundError('Раздел не найден');
  res.json({ ok: true, data: source });
});

funpayRouter.delete('/sources/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  if (!(await sourceNodesRepository.remove(id))) throw new NotFoundError('Раздел не найден');
  res.json({ ok: true, data: null });
});

// Профиль продавца площадки: рейтинг и возраст аккаунта, без контактов.
funpayRouter.get('/sellers/:externalId', async (req, res) => {
  const { externalId } = validate(z.object({ externalId: z.string().regex(/^\d+$/) }), req.params);
  const html = await funpayClient.fetchHtml(funpayClient.userUrl(externalId));
  res.json({ ok: true, data: funpayUserParser.parseUser(html) });
});
