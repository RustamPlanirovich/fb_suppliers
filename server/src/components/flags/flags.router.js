import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, adminId } from '../../utils/guard.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { FLAG_TYPES, FLAG_STATUSES, BULK_LIMIT } from '../../utils/constants.js';
import { FlagsRepository } from './flags.repository.js';
import { FlagsScanner } from './flags.scanner.js';

const repo = new FlagsRepository();
const scanner = new FlagsScanner(repo);

export const flagsRouter = Router();
flagsRouter.use(requireAuth);

const listSchema = z.object({
  status: z.enum(FLAG_STATUSES).optional(),
  entity: z.enum(['supplier', 'offer', 'variant']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  type: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
    z.array(z.enum(FLAG_TYPES)).optional(),
  ),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

flagsRouter.get('/', async (req, res) => {
  const { page, limit, ...filters } = validate(listSchema, req.query);
  const paging = normalizePaging({ page, limit });
  const { rows, total } = await repo.list({ status: 'open', ...filters }, paging);
  res.json({ ok: true, data: paged(rows, total, paging) });
});

flagsRouter.get('/summary', async (req, res) => {
  res.json({ ok: true, data: await repo.summary() });
});

flagsRouter.post('/resolve', async (req, res) => {
  const { ids, status } = validate(
    z.object({
      ids: z.array(z.coerce.number().int().positive()).min(1).max(BULK_LIMIT),
      status: z.enum(['resolved', 'ignored']),
    }),
    req.body,
  );
  res.json({ ok: true, data: { affected: await repo.resolve(ids, status, adminId(req)) } });
});

flagsRouter.post('/scan', async (req, res) => {
  res.json({ ok: true, data: await scanner.run() });
});

export { repo as flagsRepository, scanner as flagsScanner };
