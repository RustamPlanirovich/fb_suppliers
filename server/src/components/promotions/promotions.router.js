import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { writeAudit } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';
import { PROMO_SLOTS } from '../../utils/constants.js';
import { PromotionsRepository } from './promotions.repository.js';

const repo = new PromotionsRepository();

export const promotionsRouter = Router();
promotionsRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

promotionsRouter.get('/placements', async (req, res) => {
  res.json({ ok: true, data: await repo.placements() });
});

// Прайс размещения в «топе»: коды, слоты, сроки и цены задаёт админ.
promotionsRouter.put('/placements', requireRole('admin'), async (req, res) => {
  const data = validate(
    z.object({
      code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(500).optional().nullable(),
      slot: z.enum(PROMO_SLOTS).optional(),
      weight: z.coerce.number().int().min(1).max(10_000).optional(),
      days: z.coerce.number().int().positive().max(365).optional(),
      price: z.coerce.number().min(0).optional(),
      isActive: z.boolean().optional(),
    }),
    req.body,
  );
  const placement = await repo.upsertPlacement(data);
  await writeAudit({ adminId: adminId(req), entity: 'promo_placement', entityId: placement.id,
    action: 'upsert', changes: { code: data.code, price: data.price ?? 0 } });
  res.json({ ok: true, data: placement });
});

promotionsRouter.get('/', async (req, res) => {
  const { page, limit, ...filters } = validate(
    z.object({
      activeOnly: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true),
        z.boolean().optional()),
      supplierId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    }),
    req.query,
  );
  const paging = normalizePaging({ page, limit });
  const { rows, total } = await repo.list(filters, paging);
  res.json({ ok: true, data: paged(rows, total, paging) });
});

// Поставщик оплатил размещение: закрепляем на срок со скидкой за рекламу.
promotionsRouter.post('/', requireRole('admin'), async (req, res) => {
  const data = validate(
    z.object({
      supplierId: z.coerce.number().int().positive(),
      placementId: z.coerce.number().int().positive().optional(),
      categoryId: z.coerce.number().int().positive().optional().nullable(),
      slot: z.enum(PROMO_SLOTS).optional(),
      weight: z.coerce.number().int().min(1).max(10_000).optional(),
      discountPct: z.coerce.number().min(0).max(100).optional(),
      amountPaid: z.coerce.number().min(0).optional(),
      days: z.coerce.number().int().positive().max(365).optional(),
      note: z.string().trim().max(500).optional(),
    }),
    req.body,
  );
  const placement = data.placementId ? await repo.findPlacement(data.placementId) : null;
  const promotion = await repo.create({
    ...data,
    slot: data.slot ?? placement?.slot,
    weight: data.weight ?? placement?.weight,
    days: data.days ?? placement?.days,
    amountPaid: data.amountPaid ?? placement?.price,
    createdBy: adminId(req),
  });
  await writeAudit({ adminId: adminId(req), entity: 'promotion', entityId: promotion.id,
    action: 'create', changes: { supplier_id: data.supplierId, amount: promotion.amount_paid },
    comment: data.note ?? null });
  res.status(201).json({ ok: true, data: promotion });
});

promotionsRouter.post('/:id/stop', requireRole('admin'), async (req, res) => {
  const { id } = validate(idParam, req.params);
  const promotion = await repo.stop(id);
  if (!promotion) throw new NotFoundError('Размещение не найдено');
  await writeAudit({ adminId: adminId(req), entity: 'promotion', entityId: id, action: 'stop' });
  res.json({ ok: true, data: promotion });
});
