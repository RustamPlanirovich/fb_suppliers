import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth } from '../../utils/guard.js';
import { PERIODS } from '../../utils/period.js';
import { query } from '../../utils/db.js';
import { DashboardRepository } from './dashboard.repository.js';
import { MarketAnalyticsRepository } from './market.analytics.repository.js';
import { TimeseriesRepository } from './timeseries.repository.js';
import { OpportunitiesRepository, PRESETS } from './opportunities.repository.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { AnalyticsService } from './analytics.service.js';

const service = new AnalyticsService(new DashboardRepository(), new MarketAnalyticsRepository());
const timeseries = new TimeseriesRepository();
export const opportunitiesRepository = new OpportunitiesRepository();

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const periodSchema = z.object({
  period: z.enum(PERIODS).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

analyticsRouter.get('/dashboard', async (req, res) => {
  const { period } = validate(periodSchema, req.query);
  res.json({ ok: true, data: await service.dashboard(period ?? 'month') });
});

analyticsRouter.get('/market', async (req, res) => {
  const { period, limit } = validate(periodSchema, req.query);
  res.json({ ok: true, data: await service.market(period ?? 'month', limit ?? 20) });
});

const opportunitySchema = z.object({
  preset: z.enum(Object.keys(PRESETS)).optional(),
  q: z.string().trim().max(200).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  marginMin: z.coerce.number().optional(),
  marginMax: z.coerce.number().optional(),
  profitMin: z.coerce.number().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  competition: z.enum(['low', 'medium', 'high']).optional(),
  suppliersMin: z.coerce.number().int().min(0).optional(),
  sellersMax: z.coerce.number().int().min(0).optional(),
  demandMin: z.coerce.number().optional(),
  trendMin: z.coerce.number().optional(),
  trendMax: z.coerce.number().optional(),
  sort: z.enum(['margin', 'profit', 'demand', 'competition', 'trend_down', 'trend_up',
    'suppliers', 'price']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

// «Что выгодно»: гибкая витрина по марже, конкуренции, тренду цены и спросу.
// preset подставляет типовой набор условий, явные параметры его переопределяют.
analyticsRouter.get('/opportunities', async (req, res) => {
  const { preset, page, limit, ...filters } = validate(opportunitySchema, req.query);
  const paging = normalizePaging({ page, limit });
  const merged = { ...(preset ? PRESETS[preset] : {}), ...filters };
  const { rows, total } = await opportunitiesRepository.list(merged, paging);
  res.json({ ok: true, data: { ...paged(rows, total, paging), filters: merged } });
});

analyticsRouter.get('/opportunities/presets', (req, res) => {
  res.json({ ok: true, data: PRESETS });
});

// Данные витрины дашборда: ряд для графика, лента изменений цен, доли и лучшие связки.
analyticsRouter.get('/overview', async (req, res) => {
  const { metric, days } = validate(
    z.object({
      metric: z.enum(['searches', 'contacts', 'suppliers', 'offers']).optional(),
      days: z.coerce.number().int().min(3).max(30).optional(),
    }),
    req.query,
  );
  const [series, recent, shares, links] = await Promise.all([
    timeseries.daily(metric ?? 'searches', days ?? 10),
    timeseries.recentPriceChanges(6),
    timeseries.shareByProduct(5),
    timeseries.topLinks(3),
  ]);
  res.json({ ok: true, data: { series, recent, shares, links } });
});

// Общая история изменений по всем сущностям.
analyticsRouter.get('/audit', async (req, res) => {
  const { entity, entityId, adminId, limit } = validate(
    z.object({
      entity: z.string().trim().max(40).optional(),
      entityId: z.coerce.number().int().positive().optional(),
      adminId: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    }),
    req.query,
  );
  const { rows } = await query(
    `SELECT a.id, a.entity, a.entity_id, a.action, a.changes, a.comment, a.created_at,
            ad.name AS admin_name
     FROM audit_log a LEFT JOIN admins ad ON ad.id = a.admin_id
     WHERE ($1::text IS NULL OR a.entity = $1)
       AND ($2::bigint IS NULL OR a.entity_id = $2)
       AND ($3::bigint IS NULL OR a.admin_id = $3)
     ORDER BY a.created_at DESC LIMIT $4`,
    [entity ?? null, entityId ?? null, adminId ?? null, limit ?? 100],
  );
  res.json({ ok: true, data: rows });
});
