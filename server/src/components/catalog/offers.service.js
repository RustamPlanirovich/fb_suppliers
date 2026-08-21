import { withTransaction } from '../../utils/db.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { normalizePaging, paged } from '../../utils/pagination.js';
import { changePct } from '../../utils/profit.js';
import { FLAG_THRESHOLDS, PUBLIC_SUPPLIER_STATUSES, PAGE_SIZE } from '../../utils/constants.js';

// Оффер = «поставщик продаёт вариант товара по цене». Любая правка цены пишется в историю
// вместе с доказательством: кто, откуда узнал, когда.
export class OffersService {
  #repo;
  #history;
  #stats;
  #flags;

  constructor(repo, history, stats, flags) {
    this.#repo = repo;
    this.#history = history;
    this.#stats = stats;
    this.#flags = flags;
  }

  async list(filters, pagingInput) {
    const paging = normalizePaging(pagingInput);
    const { rows, total } = await this.#repo.list(filters, paging);
    return paged(rows, total, paging);
  }

  async getById(id) {
    const offer = await this.#repo.findById(id);
    if (!offer) throw new NotFoundError('Предложение не найдено');
    return offer;
  }

  async cheapest(variantId, limit = PAGE_SIZE.DEFAULT) {
    return this.#repo.cheapestByVariant(variantId, {
      limit, statuses: PUBLIC_SUPPLIER_STATUSES,
    });
  }

  async create(input, actorId) {
    if (await this.#repo.findBySupplierAndVariant(input.supplierId, input.variantId)) {
      throw new ValidationError('У этого поставщика уже есть предложение по данному варианту');
    }
    const offer = await this.#repo.create(input);
    if (input.price != null) {
      await this.#history.add({
        offerId: offer.id, price: input.price, currency: offer.currency,
        source: input.source ?? 'admin', evidence: input.evidence, adminId: actorId,
      });
    }
    await this.#afterChange(offer, actorId, 'create', { price: { to: input.price ?? null } },
      input.evidence);
    return offer;
  }

  async update(id, input, actorId) {
    const before = await this.getById(id);
    let offer = await this.#repo.updateFields(id, input);
    if (input.price != null && Number(input.price) !== Number(before.price)) {
      offer = await this.#setPrice(before, input, actorId);
    }
    await this.#afterChange(offer, actorId, 'update', {
      price: { from: before.price, to: offer.price },
      is_active: { from: before.is_active, to: offer.is_active },
    }, input.evidence);
    return offer;
  }

  // Отдельная точка входа для парсера и пользовательских правок цены.
  async setPrice(id, { price, source, evidence }, actorId) {
    const before = await this.getById(id);
    const offer = await this.#setPrice(before, { price, source, evidence }, actorId);
    await this.#afterChange(offer, actorId, 'price', { price: { from: before.price, to: price } },
      evidence);
    return offer;
  }

  async #setPrice(before, { price, source, evidence }, actorId) {
    const offer = await withTransaction(async (client) => {
      const updated = await this.#repo.applyPrice(before.id, price, client);
      await this.#history.add({
        offerId: before.id, price, currency: updated.currency,
        source: source ?? 'admin', evidence, adminId: actorId,
      }, client);
      return updated;
    });
    await this.#raisePriceFlags(before, offer);
    return offer;
  }

  // Автофлаги контроля цен: резкий скачок вверх/вниз и аномалия.
  async #raisePriceFlags(before, offer) {
    if (before.price == null || offer.price == null) return;
    const delta = changePct(before.price, offer.price);
    const details = { from: Number(before.price), to: Number(offer.price), delta_pct: delta };
    if (Math.abs(delta) >= FLAG_THRESHOLDS.ANOMALY_DEVIATION_PCT) {
      await this.#flags.raise({ entity: 'offer', entityId: offer.id, type: 'price_anomaly',
        severity: 'critical', details });
      return;
    }
    if (Math.abs(delta) >= FLAG_THRESHOLDS.PRICE_SPIKE_PCT) {
      await this.#flags.raise({
        entity: 'offer', entityId: offer.id,
        type: delta > 0 ? 'price_spike_up' : 'price_spike_down', severity: 'warning', details,
      });
    }
  }

  async remove(id, actorId) {
    const offer = await this.getById(id);
    await this.#repo.remove(id);
    await this.#stats.refresh(offer.variant_id);
    await writeAudit({ adminId: actorId, entity: 'offer', entityId: id, action: 'delete',
      changes: { supplier_id: offer.supplier_id, variant_id: offer.variant_id } });
  }

  async history(offerId, limit = 100) {
    return this.#history.byOffer(offerId, limit);
  }

  async variantSeries(variantId, days = 30) {
    return this.#history.variantSeries(variantId, days);
  }

  async #afterChange(offer, actorId, action, changes, evidence) {
    await this.#stats.refresh(offer.variant_id);
    await writeAudit({ adminId: actorId, entity: 'offer', entityId: offer.id, action, changes,
      comment: evidence ?? null });
  }
}
