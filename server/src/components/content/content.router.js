import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, adminId } from '../../utils/guard.js';
import { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';

export const contentService = new ContentService(new ContentRepository());

export const contentRouter = Router();
contentRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

contentRouter.get('/', async (req, res) => {
  res.json({ ok: true, data: await contentService.all() });
});

contentRouter.put('/', async (req, res) => {
  const data = validate(
    z.object({
      key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/),
      type: z.enum(['text', 'banner', 'button', 'notification', 'terms']).optional(),
      title: z.string().trim().max(200).optional().nullable(),
      body: z.string().max(4000),
      mediaUrl: z.string().trim().url().max(500).optional().nullable(),
      isActive: z.boolean().optional(),
    }),
    req.body,
  );
  res.json({ ok: true, data: await contentService.upsert(data, adminId(req)) });
});

contentRouter.delete('/:key', async (req, res) => {
  const { key } = validate(z.object({ key: z.string().trim().min(2).max(60) }), req.params);
  await contentService.remove(key, adminId(req));
  res.json({ ok: true, data: null });
});

contentRouter.get('/faq', async (req, res) => {
  res.json({ ok: true, data: await contentService.faq(false) });
});

contentRouter.post('/faq', async (req, res) => {
  const data = validate(
    z.object({
      question: z.string().trim().min(3).max(300),
      answer: z.string().trim().min(3).max(4000),
      sortOrder: z.coerce.number().int().optional(),
    }),
    req.body,
  );
  res.status(201).json({ ok: true, data: await contentService.createFaq(data, adminId(req)) });
});

contentRouter.patch('/faq/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  const data = validate(
    z.object({
      question: z.string().trim().min(3).max(300).optional(),
      answer: z.string().trim().min(3).max(4000).optional(),
      sortOrder: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
    }),
    req.body,
  );
  res.json({ ok: true, data: await contentService.updateFaq(id, data, adminId(req)) });
});

contentRouter.delete('/faq/:id', async (req, res) => {
  const { id } = validate(idParam, req.params);
  await contentService.removeFaq(id, adminId(req));
  res.json({ ok: true, data: null });
});
