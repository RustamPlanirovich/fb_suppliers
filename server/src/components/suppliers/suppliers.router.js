import { Router } from 'express';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { query } from '../../utils/db.js';
import { SuppliersRepository } from './suppliers.repository.js';
import { SuppliersStatsRepository } from './suppliers.stats.repository.js';
import { SuppliersBulkRepository } from './suppliers.bulk.repository.js';
import { SuppliersDuplicatesRepository } from './suppliers.duplicates.repository.js';
import { SuppliersService } from './suppliers.service.js';
import { SuppliersBulkService } from './suppliers.bulk.service.js';
import { SuppliersDuplicatesService } from './suppliers.duplicates.service.js';
import * as schemas from './suppliers.schemas.js';

const stats = new SuppliersStatsRepository();
const service = new SuppliersService(new SuppliersRepository(), stats);
const bulkService = new SuppliersBulkService(new SuppliersBulkRepository());
const duplicatesService = new SuppliersDuplicatesService(new SuppliersDuplicatesRepository(), stats);

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

suppliersRouter.get('/', async (req, res) => {
  const { page, limit, ...filters } = validate(schemas.listQuerySchema, req.query);
  res.json({ ok: true, data: await service.list(filters, { page, limit }) });
});

suppliersRouter.post('/', async (req, res) => {
  const supplier = await service.create(validate(schemas.createSchema, req.body), adminId(req));
  res.status(201).json({ ok: true, data: supplier });
});

suppliersRouter.get('/duplicates', async (req, res) => {
  const params = validate(schemas.duplicatesSchema, req.query);
  res.json({ ok: true, data: await duplicatesService.find(params) });
});

suppliersRouter.post('/duplicates/merge', requireRole('admin'), async (req, res) => {
  const data = validate(schemas.mergeSchema, req.body);
  res.json({ ok: true, data: await duplicatesService.merge(data, adminId(req)) });
});

suppliersRouter.post('/bulk', requireRole('admin'), async (req, res) => {
  const data = validate(schemas.bulkSchema, req.body);
  res.json({ ok: true, data: await bulkService.apply(data, adminId(req)) });
});

suppliersRouter.get('/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await service.getById(id) });
});

suppliersRouter.patch('/:id', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const data = validate(schemas.updateSchema, req.body);
  res.json({ ok: true, data: await service.update(id, data, adminId(req)) });
});

suppliersRouter.post('/:id/check', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const data = validate(schemas.checkSchema, req.body);
  res.json({ ok: true, data: await service.confirmCheck(id, data, adminId(req)) });
});

suppliersRouter.post('/:id/refresh-stats', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  res.json({ ok: true, data: await service.refreshStats(id) });
});

// История изменений карточки — из общего audit_log.
suppliersRouter.get('/:id/history', async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const { rows } = await query(
    `SELECT a.id, a.action, a.changes, a.comment, a.created_at, ad.name AS admin_name
     FROM audit_log a LEFT JOIN admins ad ON ad.id = a.admin_id
     WHERE a.entity = 'supplier' AND a.entity_id = $1
     ORDER BY a.created_at DESC LIMIT 200`,
    [id],
  );
  res.json({ ok: true, data: rows });
});

suppliersRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  await service.remove(id, adminId(req));
  res.json({ ok: true, data: null });
});
