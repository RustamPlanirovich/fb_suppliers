import { redis } from '../../utils/redis.js';
import { CACHE_TTL, REDIS_KEYS } from '../../utils/constants.js';
import { periodDays } from '../../utils/period.js';

// Дашборд собирается из независимых блоков и кэшируется на короткий срок.
export class AnalyticsService {
  #dashboard;
  #market;

  constructor(dashboard, market) {
    this.#dashboard = dashboard;
    this.#market = market;
  }

  async dashboard(period) {
    const cached = await redis.get(REDIS_KEYS.dashboard(period));
    if (cached) return JSON.parse(cached);
    const data = await this.#collect(periodDays(period));
    await redis.set(REDIS_KEYS.dashboard(period), JSON.stringify(data), 'EX', CACHE_TTL.SHORT);
    return data;
  }

  async #collect(days) {
    const [suppliers, newSuppliers, catalog, users, events, searches, moderation, revenue] =
      await Promise.all([
        this.#dashboard.suppliers(),
        this.#dashboard.newSuppliers(days),
        this.#dashboard.catalog(),
        this.#dashboard.users(days),
        this.#dashboard.events(days),
        this.#dashboard.searches(days),
        this.#dashboard.moderation(),
        this.#dashboard.revenue(days),
      ]);
    return {
      period_days: days,
      suppliers: { ...suppliers, new: newSuppliers },
      catalog,
      users,
      activity: {
        searches: searches.total,
        empty_searches: searches.empty,
        contact_opens: events.contact_open ?? 0,
        favorites: events.favorite_add ?? 0,
        complaints: events.complaint ?? 0,
        calculations: events.calc ?? 0,
      },
      moderation,
      revenue,
    };
  }

  async market(period, limit = 20) {
    const days = periodDays(period);
    const [topQueries, emptyQueries, topVariants, topMargin, topSuppliers, declining, alerts, saved] =
      await Promise.all([
        this.#market.topQueries(days, limit),
        this.#market.emptyQueries(days, limit),
        this.#market.topVariants(days, limit),
        this.#market.topMargin(limit),
        this.#market.topSuppliers(days, limit),
        this.#market.decliningSuppliers(limit),
        this.#market.alertTypes(limit),
        this.#market.savedVariants(limit),
      ]);
    return {
      top_queries: topQueries,
      empty_queries: emptyQueries,
      top_variants: topVariants,
      top_margin: topMargin,
      top_suppliers: topSuppliers,
      declining_suppliers: declining,
      alert_types: alerts,
      saved_variants: saved,
    };
  }
}
