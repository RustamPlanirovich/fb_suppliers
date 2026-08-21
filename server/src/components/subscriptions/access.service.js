import { redis } from '../../utils/redis.js';
import { CACHE_TTL, REDIS_KEYS } from '../../utils/constants.js';

// Доступ пользователя к возможностям: активная подписка или тариф по умолчанию.
// Набор возможностей задаёт админ в plans.features — код только читает флаги.
export class AccessService {
  #plans;
  #subscriptions;

  constructor(plans, subscriptions) {
    this.#plans = plans;
    this.#subscriptions = subscriptions;
  }

  async forUser(userId) {
    const active = await this.#subscriptions.activeForUser(userId);
    const plan = active ?? (await this.#plans.findDefault());
    if (!plan) return { planCode: 'none', features: {}, endsAt: null };
    return {
      planCode: plan.plan_code ?? plan.code,
      planName: plan.plan_name ?? plan.name,
      features: plan.features ?? {},
      endsAt: active?.ends_at ?? null,
    };
  }

  can(access, feature) {
    return Boolean(access.features?.[feature]);
  }

  limit(access, feature, fallback = 0) {
    const value = Number(access.features?.[feature]);
    return Number.isFinite(value) ? value : fallback;
  }

  // Суточная квота поисков: 0 в тарифе означает «без ограничений».
  async consumeSearch(userId, access) {
    const perDay = this.limit(access, 'searches_per_day', 0);
    if (perDay <= 0) return { allowed: true, left: null };
    const day = new Date().toISOString().slice(0, 10);
    const key = REDIS_KEYS.searchQuota(userId, day);
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, CACHE_TTL.DAY);
    return { allowed: used <= perDay, left: Math.max(0, perDay - used) };
  }
}
