import { calcProfit, competitionLevel, riskLevel } from '../../utils/profit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { BULK_LIMIT } from '../../utils/constants.js';

const STALE_HOURS = 48;
const BATCH_SIZE = 2000;
// Предохранитель от бесконечного цикла, а не ограничение выдачи.
const MAX_BATCHES = 100;

// Сканер связок: «купить у поставщика → продать на площадке». Считает прибыль, ROI и риск.
export class ArbitrageService {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  // Считается всё, что есть: партиями по BATCH_SIZE, пока данные не кончатся.
  async recompute() {
    let saved = 0;
    let batches = 0;
    for (; batches < MAX_BATCHES; batches += 1) {
      const inputs = await this.#repo.computeInputs(BATCH_SIZE, saved);
      if (!inputs.length) break;
      for (const input of inputs) await this.#repo.upsert(this.#buildLink(input));
      saved += inputs.length;
      if (inputs.length < BATCH_SIZE) break;
    }
    const deactivated = await this.#repo.deactivateStale(STALE_HOURS);
    return { computed: saved, deactivated, truncated: batches >= MAX_BATCHES };
  }

  #buildLink(input) {
    const money = calcProfit({
      buyPrice: input.buy_price,
      sellPrice: input.sell_price,
      commissionPct: input.commission_pct,
      payoutFee: input.payout_fee,
    });
    const ageHours = Math.round((Date.now() - new Date(input.price_checked_at).getTime()) / 3_600_000);
    return {
      variantId: input.variant_id,
      offerId: input.offer_id,
      marketplaceId: input.marketplace_id,
      buyPrice: money.buyPrice,
      sellPrice: money.sellPrice,
      commissionPct: input.commission_pct,
      payoutFee: input.payout_fee,
      profit: money.profitPerUnit,
      roiPct: money.roiPct,
      marginPct: money.marginPct,
      priceAgeHours: ageHours,
      competition: competitionLevel(input.sellers_count),
      riskLevel: riskLevel({
        priceAgeHours: ageHours,
        reliability: input.score_reliability,
        confirmedDeals: input.confirmed_deals_30d,
      }),
    };
  }

  async list(filters, pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#repo.list(filters, paging);
    return paged(rows, total, paging);
  }

  async setMark(id, { mark, note }, actorId) {
    const link = await this.#repo.setMark(id, mark, note);
    if (!link) throw new NotFoundError('Связка не найдена');
    await writeAudit({ adminId: actorId, entity: 'arbitrage', entityId: id, action: 'mark',
      changes: { admin_mark: { to: mark } }, comment: note ?? null });
    return link;
  }

  // «Что сейчас выгодно перепродавать» — витрина возможностей для бота.
  async opportunities({ roiMin = 20, limit = 20, buyMax } = {}) {
    const paging = normalizePaging({ limit: Math.min(limit, BULK_LIMIT) });
    const { rows } = await this.#repo.list(
      { roiMin, buyMax, adminMark: undefined, sort: 'roi' }, paging,
    );
    return rows.filter((row) => row.admin_mark !== 'stale');
  }
}
