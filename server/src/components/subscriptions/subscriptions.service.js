import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';

export class SubscriptionsService {
  #plans;
  #subs;
  #promos;

  constructor(plans, subs, promos) {
    this.#plans = plans;
    this.#subs = subs;
    this.#promos = promos;
  }

  async listPlans(activeOnly) {
    return this.#plans.all(activeOnly);
  }

  async createPlan(input, actorId) {
    if (await this.#plans.findByCode(input.code)) throw new ValidationError('Код тарифа уже занят');
    const plan = await this.#plans.create(input);
    await writeAudit({ adminId: actorId, entity: 'plan', entityId: plan.id, action: 'create',
      changes: { code: input.code, features: input.features ?? {} } });
    return plan;
  }

  async updatePlan(id, input, actorId) {
    const plan = await this.#plans.update(id, input);
    if (!plan) throw new NotFoundError('Тариф не найден');
    await writeAudit({ adminId: actorId, entity: 'plan', entityId: id, action: 'update',
      changes: input });
    return plan;
  }

  async setDefaultPlan(id, actorId) {
    const plan = await this.#plans.setDefault(id);
    if (!plan) throw new NotFoundError('Тариф не найден');
    await writeAudit({ adminId: actorId, entity: 'plan', entityId: id, action: 'set_default' });
    return plan;
  }

  async removePlan(id, actorId) {
    if (!(await this.#plans.remove(id))) {
      throw new ValidationError('Тариф не найден или является тарифом по умолчанию');
    }
    await writeAudit({ adminId: actorId, entity: 'plan', entityId: id, action: 'delete' });
  }

  // Ручная выдача/продление доступа администратором.
  async grant({ userId, planId, days, comment }, actorId) {
    const plan = await this.#plans.findById(planId);
    if (!plan) throw new NotFoundError('Тариф не найден');
    const active = await this.#subs.activeForUser(userId);
    const subscription = active && Number(active.plan_id) === Number(planId)
      ? await this.#subs.extend(active.id, days ?? plan.days)
      : await this.#subs.grant({ userId, planId, days: days ?? plan.days, createdBy: actorId });
    await writeAudit({ adminId: actorId, entity: 'subscription', entityId: subscription.id,
      action: active ? 'extend' : 'grant',
      changes: { user_id: userId, plan_id: planId, days: days ?? plan.days }, comment });
    return subscription;
  }

  async cancel(id, actorId) {
    const subscription = await this.#subs.cancel(id);
    if (!subscription) throw new NotFoundError('Подписка не найдена');
    await writeAudit({ adminId: actorId, entity: 'subscription', entityId: id, action: 'cancel' });
    return subscription;
  }

  async history(userId) {
    return this.#subs.history(userId);
  }

  async listPayments(filters, pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#subs.listPayments(filters, paging);
    return paged(rows, total, paging);
  }

  async registerPayment(input, actorId) {
    const payment = await this.#subs.createPayment(input);
    await writeAudit({ adminId: actorId, entity: 'payment', entityId: payment.id, action: 'create',
      changes: { amount: input.amount, status: input.status ?? 'pending' } });
    return payment;
  }

  async listPromoCodes() {
    return this.#promos.all();
  }

  async createPromoCode(input, actorId) {
    const promo = await this.#promos.create(input);
    await writeAudit({ adminId: actorId, entity: 'promo_code', entityId: promo.id, action: 'create',
      changes: { code: promo.code } });
    return promo;
  }

  async setPromoActive(id, isActive, actorId) {
    const promo = await this.#promos.setActive(id, isActive);
    if (!promo) throw new NotFoundError('Промокод не найден');
    await writeAudit({ adminId: actorId, entity: 'promo_code', entityId: id, action: 'set_active',
      changes: { is_active: { to: isActive } } });
    return promo;
  }

  // Применение промокода при покупке подписки пользователем бота.
  async redeem({ userId, code }) {
    const promo = await this.#promos.findUsable(code);
    if (!promo) throw new ValidationError('Промокод недействителен');
    const plan = promo.plan_id ? await this.#plans.findById(promo.plan_id) : null;
    if (plan) {
      await this.#subs.grant({
        userId, planId: plan.id, days: plan.days + promo.bonus_days, source: 'promo',
      });
    }
    await this.#promos.markUsed(promo.id);
    return { discountPct: Number(promo.discount_pct), bonusDays: promo.bonus_days,
      planCode: plan?.code ?? null };
  }
}
