import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { ValidationError } from '../../utils/errors.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { IMPORT_TARGETS } from '../../utils/constants.js';
import { SuppliersRepository } from '../suppliers/suppliers.repository.js';
import { SuppliersStatsRepository } from '../suppliers/suppliers.stats.repository.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { catalogService, offersService } from '../catalog/catalog.container.js';
import { TableParser } from './table.parser.js';
import { TableWriter } from './table.writer.js';
import { ImportRepository } from './import.repository.js';
import { ImportService } from './import.service.js';
import { ExportService, EXPORT_TARGETS } from './export.service.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

const importService = new ImportService(new ImportRepository(), new TableParser(), {
  suppliersService: new SuppliersService(new SuppliersRepository(), new SuppliersStatsRepository()),
  catalogService,
  offersService,
});
const exportService = new ExportService(new TableWriter());

export const ioRouter = Router();
ioRouter.use(requireAuth);

ioRouter.get('/imports', async (req, res) => {
  res.json({ ok: true, data: await importService.list() });
});

// Шаг 1: загрузка файла — возвращает заголовки, подсказку сопоставления, пример строк и дубли.
ioRouter.post('/imports/preview', requireRole('admin'), upload.single('file'), async (req, res) => {
  const { target } = validate(z.object({ target: z.enum(IMPORT_TARGETS) }), req.body);
  if (!req.file) throw new ValidationError('Файл не передан');
  const preview = await importService.preview({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    target,
    adminId: adminId(req),
  });
  res.status(201).json({ ok: true, data: preview });
});

// Шаг 2: применение с подтверждённым сопоставлением колонок.
ioRouter.post('/imports/:id/apply', requireRole('admin'), async (req, res) => {
  const { id } = validate(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const { mapping } = validate(
    z.object({ mapping: z.record(z.string(), z.coerce.number().int().min(0)) }), req.body);
  res.json({ ok: true, data: await importService.apply(id, mapping, adminId(req)) });
});

ioRouter.get('/exports/:target', async (req, res) => {
  const { target } = validate(z.object({ target: z.enum(EXPORT_TARGETS) }), req.params);
  const { format } = validate(z.object({ format: z.enum(['csv', 'xlsx']).optional() }), req.query);
  const file = await exportService.build(target, format ?? 'xlsx');
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});
