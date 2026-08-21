import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../../utils/audit.js';
import { priceStats, withoutOutliers } from '../../utils/aggregate.js';
import { OfferGrouping } from './source.grouping.js';
import { SourceSellers } from './source.sellers.js';
import { CategoriesAutocreate } from '../categories/categories.autocreate.js';

const log = logger.child({ component: 'sources' });

// Синхронизация раздела площадки, одинаковая для всех источников.
// Различия площадок живут в провайдерах: как получить каталог и как разобрать раздел.
export class SourceSyncService {
  #providers;
  #market;
  #catalog;
  #stats;
  #grouping = new OfferGrouping();
  #categories = new CategoriesAutocreate();
  #sellers;

  constructor({ providers, market, catalog, stats, suppliersRepo, offersRepo, historyRepo }) {
    this.#providers = providers;
    this.#market = market;
    this.#catalog = catalog;
    this.#stats = stats;
    this.#sellers = new SourceSellers(suppliersRepo, offersRepo, historyRepo);
  }

  provider(code) {
    const provider = this.#providers[code];
    if (!provider) throw new ValidationError(`Источник «${code}» не поддерживается`);
    return provider;
  }

  async games(code, params) {
    return this.provider(code).games(params);
  }

  // Предпросмотр без записи: администратор видит, что придёт в базу.
  async preview(code, input) {
    const parsed = await this.#fetch(code, input);
    const variantAttrs = input.variantAttrs ?? parsed.filters;
    const groups = this.#grouping.group(parsed.offers,
      { variantAttrs, titleRules: input.titleRules });
    return {
      source: code,
      total: parsed.offers.length,
      sellers: new Set(parsed.offers.map((offer) => offer.sellerId)).size,
      currency: parsed.currency,
      availableAttrs: parsed.filters,
      usedAttrs: variantAttrs,
      needsRules: !variantAttrs.length && !input.titleRules?.length,
      // Площадка может не отдать весь раздел за один проход — об этом нужнознать заранее.
      truncated: Boolean(parsed.truncated),
      sourceTotal: parsed.sourceTotal ?? parsed.offers.length,
      groups: groups.slice(0, 30).map((group) => ({
        name: group.name,
        offers: group.offers.length,
        sellers: new Set(group.offers.map((offer) => offer.sellerId)).size,
        ...priceStats(withoutOutliers(group.offers.map((offer) => offer.price))),
      })),
      sample: parsed.offers.slice(0, 10),
    };
  }

  async sync(code, input, actorId) {
    const marketplace = await this.#market.findMarketplace(code);
    if (!marketplace) throw new ValidationError(`Площадка «${code}» не заведена в справочнике`);

    const parsed = await this.#fetch(code, input);
    const category = input.categoryId
      ? { id: input.categoryId }
      : await this.#categories.ensure({ gameName: input.gameName, nodeName: input.nodeName });
    const variantAttrs = input.variantAttrs ?? parsed.filters;
    const groups = this.#grouping.group(parsed.offers, { variantAttrs, titleRules: input.titleRules });

    const results = [];
    for (const group of groups) {
      results.push(await this.#syncGroup({ code, group, input, marketplace, parsed, category }));
    }

    const summary = {
      source: code,
      nodeId: input.nodeId,
      offers: parsed.offers.length,
      variants: results.length,
      suppliersCreated: results.reduce((sum, row) => sum + row.suppliersCreated, 0),
      offersCreated: results.reduce((sum, row) => sum + row.offersCreated, 0),
      offersUpdated: results.reduce((sum, row) => sum + row.offersUpdated, 0),
      offersDeactivated: results.reduce((sum, row) => sum + row.offersDeactivated, 0),
      groups: results,
    };
    await writeAudit({
      adminId: actorId, entity: 'source_node', entityId: null, action: 'sync',
      changes: { ...summary, groups: undefined }, comment: input.url ?? String(input.nodeId),
    });
    log.info('Раздел площадки синхронизирован',
      { source: code, nodeId: input.nodeId, offers: summary.offers });
    return summary;
  }

  async #syncGroup({ code, group, input, marketplace, parsed, category }) {
    const { variant } = await this.#catalog.resolveVariant({
      productName: input.productName,
      variantName: group.name,
      categoryId: category?.id,
    });
    const stats = priceStats(withoutOutliers(group.offers.map((offer) => offer.price)));
    await this.#market.addSnapshot({
      variantId: variant.id,
      marketplaceId: marketplace.id,
      ...stats,
      sellersCount: new Set(group.offers.map((offer) => offer.sellerId)).size,
      sourceUrl: input.url ?? null,
      sourceNodeId: String(input.nodeId),
    });

    const saved = input.withSellers === false
      ? { suppliersCreated: 0, offersCreated: 0, offersUpdated: 0, offersDeactivated: 0 }
      : await this.#sellers.save({
        offers: this.#grouping.cheapestBySeller(group.offers),
        variantId: variant.id,
        currency: parsed.currency,
        source: code,
        sellerStatus: input.sellerStatus,
        evidence: `Синхронизация раздела ${code} ${input.nodeId}`,
      });

    await this.#stats.refresh(variant.id);
    return {
      variant: group.name, variantId: Number(variant.id), offers: group.offers.length,
      ...stats, ...saved,
    };
  }

  async #fetch(code, input) {
    const parsed = await this.provider(code).fetchNode(input);
    if (!parsed.offers.length) {
      throw new ValidationError('В разделе не найдено ни одного предложения');
    }
    return parsed;
  }

  async syncMany(code, nodes, actorId) {
    const results = [];
    for (const node of nodes) {
      try {
        results.push(await this.sync(code, node, actorId));
      } catch (err) {
        log.warn('Раздел не синхронизирован', { source: code, nodeId: node.nodeId, err: err.message });
        results.push({ nodeId: node.nodeId, error: err.message });
      }
    }
    return results;
  }
}
