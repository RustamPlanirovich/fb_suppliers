import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'funpay' });

// Сохранение продавцов площадки и их предложений.
// Контакты не пишутся: у карточек с источником-площадкой они запрещены ограничением БД.
export class FunpaySellers {
  #suppliers;
  #offers;
  #history;

  constructor(suppliersRepo, offersRepo, historyRepo) {
    this.#suppliers = suppliersRepo;
    this.#offers = offersRepo;
    this.#history = historyRepo;
  }

  async save({ offers, variantId, currency, source, sellerStatus, evidence }) {
    const result = { suppliersCreated: 0, offersCreated: 0, offersUpdated: 0, offersDeactivated: 0 };
    const keepIds = [];
    for (const offer of offers) {
      const saved = await this.#saveOne({ offer, variantId, currency, source, sellerStatus, evidence });
      if (!saved) continue;
      keepIds.push(String(offer.offerId));
      result.suppliersCreated += saved.supplierCreated ? 1 : 0;
      result.offersCreated += saved.offerCreated ? 1 : 0;
      result.offersUpdated += saved.offerCreated ? 0 : 1;
    }
    result.offersDeactivated = await this.#offers.deactivateMissing(variantId, keepIds, source);
    return result;
  }

  async #saveOne({ offer, variantId, currency, source, sellerStatus, evidence }) {
    try {
      const supplier = await this.#suppliers.upsertMarketplaceSeller({
        source,
        externalId: offer.sellerId,
        name: offer.sellerName ?? `Продавец ${offer.sellerId}`,
        url: offer.sellerUrl,
        rating: offer.sellerRating,
        reviewsCount: offer.sellerReviews,
        stats: { online: offer.sellerOnline, info: offer.sellerInfo },
        status: sellerStatus,
      });
      const saved = await this.#offers.upsertExternal({
        variantId,
        supplierId: supplier.id,
        title: offer.title,
        price: offer.price,
        currency: offer.currency ?? currency,
        url: offer.url,
        externalId: String(offer.offerId),
      });
      // История цены пишется, только когда цена действительно изменилась,
      // иначе каждая синхронизация раздувала бы её одинаковыми записями.
      if (saved.inserted || Number(saved.prev_price) !== Number(saved.price)) {
        await this.#history.add({
          offerId: saved.id,
          price: saved.price,
          currency: offer.currency ?? currency,
          source: 'parser',
          evidence,
        });
      }
      return { supplierCreated: supplier.inserted, offerCreated: saved.inserted };
    } catch (err) {
      log.warn('Продавец не сохранён', { sellerId: offer.sellerId, err: err.message });
      return null;
    }
  }
}
