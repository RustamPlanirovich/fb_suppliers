import { ValidationError } from '../../utils/errors.js';
import { catalogService, offersService } from '../catalog/catalog.container.js';

// Применение одобренной пользовательской правки. Каждый тип — свой приватный метод.
export class SubmissionsApplier {
  #suppliersService;

  constructor(suppliersService) {
    this.#suppliersService = suppliersService;
  }

  async apply(submission, adminId) {
    const payload = submission.payload ?? {};
    const evidence = submission.evidence ?? `Правка пользователя #${submission.id}`;
    switch (submission.type) {
      case 'new_supplier': return this.#newSupplier(payload, evidence, adminId);
      case 'new_offer': return this.#newOffer(payload, evidence, adminId);
      case 'price_update': return this.#priceUpdate(submission, payload, evidence, adminId);
      case 'out_of_stock': return this.#outOfStock(submission, evidence, adminId);
      default: return { applied: false, reason: 'Тип не требует автоматического применения' };
    }
  }

  async #newSupplier(payload, evidence, adminId) {
    if (!payload.name) throw new ValidationError('В заявке нет названия поставщика');
    const supplier = await this.#suppliersService.create(
      { ...payload, source: 'user', status: 'pending', evidence }, adminId,
    );
    return { applied: true, supplierId: supplier.id };
  }

  async #newOffer(payload, evidence, adminId) {
    const { variant } = await catalogService.resolveVariant({
      productName: payload.productName,
      variantName: payload.variantName,
    });
    const offer = await offersService.create({
      variantId: variant.id,
      supplierId: payload.supplierId,
      title: payload.title ?? null,
      price: payload.price ?? null,
      source: 'user',
      evidence,
    }, adminId);
    return { applied: true, offerId: offer.id };
  }

  async #priceUpdate(submission, payload, evidence, adminId) {
    if (!submission.offer_id) throw new ValidationError('В заявке не указано предложение');
    await offersService.setPrice(submission.offer_id,
      { price: payload.price, source: 'user', evidence }, adminId);
    return { applied: true, offerId: Number(submission.offer_id) };
  }

  async #outOfStock(submission, evidence, adminId) {
    if (!submission.offer_id) throw new ValidationError('В заявке не указано предложение');
    await offersService.update(submission.offer_id, { isActive: false, evidence }, adminId);
    return { applied: true, offerId: Number(submission.offer_id) };
  }
}
