import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, adminId } from '../../utils/guard.js';
import { slugify } from '../../utils/text.js';
import { NotFoundError } from '../../utils/errors.js';
import { CategoriesRepository } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';
import { TagsRepository } from './tags.repository.js';

const service = new CategoriesService(new CategoriesRepository());
const tags = new TagsRepository();

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

categoriesRouter.get('/', async (req, res) => {
  res.json({ ok: true, data: await service.tree() });
});

categoriesRouter.post('/', async (req, res) => {
  const data = validate(
    z.object({
      name: z.string().trim().min(2).max(120),
      parentId: z.coerce.number().int().positive().optional().nullable(),
      sortOrder: z.coerce.number().int().optional(),
      funpayUrl: z.string().trim().url().max(500).optional().nullable(),
    }),
    req.body,
  );
  res.status(201).json({ ok: true, data: await service.create(data, adminId(req)) });
});

categoriesRouter.patch('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const data = validate(
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      sortOrder: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
      funpayUrl: z.string().trim().url().max(500).optional().nullable(),
    }),
    req.body,
  );
  res.json({ ok: true, data: await service.update(id, data, adminId(req)) });
});

categoriesRouter.post('/:id/move', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const { parentId } = validate(
    z.object({ parentId: z.coerce.number().int().positive().nullable() }), req.body);
  res.json({ ok: true, data: await service.move(id, parentId, adminId(req)) });
});

categoriesRouter.delete('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  await service.remove(id, adminId(req));
  res.json({ ok: true, data: null });
});

// --- теги ---
export const tagsRouter = Router();
tagsRouter.use(requireAuth);

tagsRouter.get('/', async (req, res) => {
  res.json({ ok: true, data: await tags.all() });
});

tagsRouter.post('/', async (req, res) => {
  const data = validate(
    z.object({
      name: z.string().trim().min(2).max(60),
      color: z.string().trim().max(20).optional().nullable(),
    }),
    req.body,
  );
  res.status(201).json({ ok: true, data: await tags.create({ ...data, slug: slugify(data.name) }) });
});

tagsRouter.patch('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const data = validate(
    z.object({
      name: z.string().trim().min(2).max(60).optional(),
      color: z.string().trim().max(20).optional().nullable(),
    }),
    req.body,
  );
  const tag = await tags.update(id, data);
  if (!tag) throw new NotFoundError('Тег не найден');
  res.json({ ok: true, data: tag });
});

tagsRouter.delete('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  if (!(await tags.remove(id))) throw new NotFoundError('Тег не найден');
  res.json({ ok: true, data: null });
});
