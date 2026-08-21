import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';
import { config } from '../../utils/config.js';
import { writeAudit } from '../../utils/audit.js';
import { priceStats, withoutOutliers } from '../../utils/aggregate.js';
import { OfferGrouping } from './funpay.grouping.js';
import { FunpaySellers } from './funpay.sellers.js';

const log = logger.child({ component: 'funpay' });
const MARKETPLACE_CODE = 'funpay';

// Синхронизация раздела площадки: страница → варианты товара → срез рыночных цен
// и (по желанию) карточки продавцов с их предложениями.
// Площадка — источник цен: контакты продавцов не собираются (ADR 0004).
export class FunpaySyncService {
  #client;
  #parser;
  #market;
  #catalog;
  #stats;
  #grouping = new OfferGrouping();
  #sellers;

  constructor({ client, parser, market, catalog, stats, suppliersRepo, offersRepo, historyRepo }) {
    this.#client = client;
    this.#parser = parser;
    this.#market = market;
    this.#catalog = catalog;
    this.#stats = stats;
    this.#sellers = new FunpaySellers(suppliersRepo, offersRepo, historyRepo);
  }

  // Предпросмотр без записи: администратор видит, что придёт в базу.
  async preview({ nodeId, kind = 'lots', url, variantAttrs, titleRules }) {
    const parsed = await this.#fetchNode({ nodeId, kind, url });
    // По умолчанию вариант собирается из всех фильтров раздела — так же, как предлагает админка.
    const attrs = variantAttrs ?? parsed.filters;
    const groups = this.#grouping.group(parsed.offers, { variantAttrs: attrs, titleRules });
    return {
      total: parsed.offers.length,
      sellers: new Set(parsed.offers.map((offer) => offer.sellerId)).size,
      currency: parsed.currency,
      availableAttrs: parsed.filters,
      usedAttrs: attrs,
      // Без фильтров и правил весь раздел схлопнется в один вариант, а средняя цена
      // по разнородным предложениям бесполезна для расчёта маржи.
      needsRules: !attrs.length && !titleRules?.length,
      groups: groups.slice(0, 30).map((group) => ({
        name: group.name,
        offers: group.offers.length,
        sellers: new Set(group.offers.map((offer) => offer.sellerId)).size,
        ...priceStats(withoutOutliers(group.offers.map((offer) => offer.price))),
      })),
      sample: parsed.offers.slice(0, 10),
    };
  }

  async syncNode(input, actorId) {
    const marketplace = await this.#market.findMarketplace(MARKETPLACE_CODE);
    if (!marketplace) throw new ValidationError('Площадка funpay не заведена в справочнике');

    const parsed = await this.#fetchNode(input);
    // То же правило по умолчанию, что и в предпросмотре: иначе загрузка даёт не то,
    // что администратор увидел перед нажатием кнопки.
    const variantAttrs = input.variantAttrs ?? parsed.filters;
    const groups = this.#grouping.group(parsed.offers,
      { variantAttrs, titleRules: input.titleRules });
    const results = [];
    for (const group of groups) {
      results.push(await this.#syncGroup({ group, input, marketplace, parsed, actorId }));
    }

    const summary = {
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
      changes: { node_id: input.nodeId, ...summary, groups: undefined },
      comment: input.url ?? this.#client.nodeUrl(input.nodeId, input.kind),
    });
    log.info('Раздел площадки синхронизирован', { nodeId: input.nodeId, offers: summary.offers });
    return summary;
  }

  async #syncGroup({ group, input, marketplace, parsed, actorId }) {
    const { variant } = await this.#catalog.resolveVariant({
      productName: input.productName,
      variantName: group.name,
      categoryId: input.categoryId,
    });
    const stats = priceStats(withoutOutliers(group.offers.map((offer) => offer.price)));
    await this.#market.addSnapshot({
      variantId: variant.id,
      marketplaceId: marketplace.id,
      ...stats,
      sellersCount: new Set(group.offers.map((offer) => offer.sellerId)).size,
      sourceUrl: input.url ?? this.#client.nodeUrl(input.nodeId, input.kind),
      sourceNodeId: String(input.nodeId),
    });

    const saved = input.withSellers === false
      ? { suppliersCreated: 0, offersCreated: 0, offersUpdated: 0, offersDeactivated: 0 }
      : await this.#sellers.save({
        offers: this.#grouping.cheapestBySeller(group.offers),
        variantId: variant.id,
        currency: parsed.currency,
        source: MARKETPLACE_CODE,
        sellerStatus: input.sellerStatus,
        evidence: `Синхронизация раздела площадки ${input.nodeId}`,
      });

    await this.#stats.refresh(variant.id);
    return { variant: group.name, variantId: Number(variant.id), offers: group.offers.length, ...stats, ...saved };
  }

  async #fetchNode({ nodeId, kind = 'lots', url }) {
    const target = url ?? this.#client.nodeUrl(nodeId, kind);
    const html = await this.#client.fetchHtml(target);
    const parsed = this.#parser.parseNode(html);
    if (!parsed.offers.length) {
      throw new ValidationError('На странице раздела не найдено ни одного предложения');
    }
    // Страховка от смены валюты витрины: цены в чужой валюте испортили бы расчёт маржи.
    const expected = config.funpay.currency.toUpperCase();
    if (parsed.currency !== expected) {
      throw new ValidationError(
        `Площадка отдала цены в ${parsed.currency}, ожидалось ${expected} — синхронизация остановлена`,
      );
    }
    return parsed;
  }

  async syncMany(nodes, actorId) {
    const results = [];
    for (const node of nodes) {
      try {
        results.push(await this.syncNode(node, actorId));
      } catch (err) {
        log.warn('Раздел не синхронизирован', { nodeId: node.nodeId, err: err.message });
        results.push({ nodeId: node.nodeId, error: err.message });
      }
    }
    return results;
  }
}
