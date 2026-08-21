import { normalizeQuery } from '../../utils/text.js';
import { calcProfit } from '../../utils/profit.js';
import { BOT_LIMITS, PUBLIC_SUPPLIER_STATUSES, SORT_FIELDS } from '../../utils/constants.js';

const SORTERS = {
  [SORT_FIELDS.PRICE]: (a, b) => Number(a.price ?? Infinity) - Number(b.price ?? Infinity),
  [SORT_FIELDS.RELIABILITY]: (a, b) =>
    Number(b.score_reliability ?? 0) - Number(a.score_reliability ?? 0),
  [SORT_FIELDS.SALES]: (a, b) => Number(b.confirmed_deals_30d ?? 0) - Number(a.confirmed_deals_30d ?? 0),
  [SORT_FIELDS.REVIEWS]: (a, b) => Number(b.reviews_count ?? 0) - Number(a.reviews_count ?? 0),
  [SORT_FIELDS.QUALITY]: (a, b) => Number(b.quality_score ?? 0) - Number(a.quality_score ?? 0),
};

// Поиск для бота: запрос → варианты товара → предложения поставщиков с расчётом маржи.
export class SearchService {
  #repo;
  #variants;
  #offers;
  #market;

  constructor(repo, variants, offers, market) {
    this.#repo = repo;
    this.#variants = variants;
    this.#offers = offers;
    this.#market = market;
  }

  async searchVariants({ text, userId, limit = BOT_LIMITS.RESULTS_PER_PAGE }) {
    const normalized = normalizeQuery(text);
    const variants = await this.#variants.search(normalized, limit);
    await this.#repo.log({ userId, text, normalized, resultsCount: variants.length });
    return variants;
  }

  // «Найти где дешевле»: предложения по варианту, отсортированные и обогащённые маржой.
  async offersFor(variantId, { sort = SORT_FIELDS.PRICE, limit = BOT_LIMITS.RESULTS_PER_PAGE } = {}) {
    const [offers, market] = await Promise.all([
      this.#offers.cheapestByVariant(variantId, { limit: 50, statuses: PUBLIC_SUPPLIER_STATUSES }),
      this.#market.latestByVariant(variantId),
    ]);
    const best = this.#bestMarket(market);
    const enriched = offers.map((offer) => this.#withProfit(offer, best));
    const promoted = await this.#applyPromotions(enriched);
    return { offers: promoted.sort(SORTERS[sort] ?? SORTERS[SORT_FIELDS.PRICE]).slice(0, limit),
      market: best };
  }

  #bestMarket(rows) {
    if (!rows.length) return null;
    return rows.reduce((best, row) =>
      (Number(row.price_avg ?? 0) > Number(best.price_avg ?? 0) ? row : best), rows[0]);
  }

  #withProfit(offer, market) {
    if (!market || offer.price == null) return { ...offer, profit: null };
    const money = calcProfit({
      buyPrice: offer.price,
      sellPrice: market.price_avg,
      commissionPct: market.commission_pct,
      payoutFee: market.payout_fee,
    });
    return { ...offer, profit: money, marketplace: market.marketplace_name };
  }

  // Оплаченное размещение поднимает поставщика наверх: помечаем и даём приоритет сортировки.
  async #applyPromotions(offers) {
    const promoted = await this.#repo.promotedSupplierIds(null);
    if (!promoted.length) return offers;
    const weights = new Map(promoted.map((row) => [row.supplierId, row.weight]));
    return offers.map((offer) => ({
      ...offer,
      is_promoted: weights.has(Number(offer.supplier_id)),
      promo_weight: weights.get(Number(offer.supplier_id)) ?? 0,
    })).sort((a, b) => (b.promo_weight ?? 0) - (a.promo_weight ?? 0));
  }

  async logEvent(event) {
    return this.#repo.logEvent(event);
  }
}
