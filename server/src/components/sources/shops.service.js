import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'sources' });

// Массовое подключение магазинов: администратор вставляет список ссылок или ID,
// каждый магазин заводится, загружается и при желании ставится на автообновление.
export class ShopsService {
  #sync;
  #nodes;
  #market;

  constructor({ sync, nodes, market }) {
    this.#sync = sync;
    this.#nodes = nodes;
    this.#market = market;
  }

  async connect(providerCode, { items, sellerStatus, titleRules, save }, actorId) {
    const provider = this.#sync.provider(providerCode);
    const marketplace = await this.#market.findMarketplace(providerCode);
    const results = [];
    for (const item of items) {
      results.push(await this.#connectOne({
        provider, providerCode, marketplace, item, sellerStatus, titleRules, save, actorId,
      }));
    }
    return {
      connected: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
      shops: results,
    };
  }

  async #connectOne({ provider, providerCode, marketplace, item, sellerStatus, titleRules, save, actorId }) {
    try {
      const [shop] = await provider.games({ q: item });
      if (!shop) return { input: item, ok: false, error: 'Магазин не найден' };
      const node = shop.nodes[0];
      const input = {
        nodeId: node.nodeId,
        url: node.url,
        productName: shop.name,
        gameName: provider.title,
        nodeName: shop.name,
        titleRules,
        withSellers: true,
        sellerStatus,
      };
      const result = await this.#sync.sync(providerCode, input, actorId);
      if (save && marketplace) {
        await this.#nodes.upsert({
          ...input, marketplaceId: marketplace.id, createdBy: actorId, withSellers: true,
        });
      }
      return {
        input: item, ok: true, shop: shop.name,
        offers: result.offers, suppliers: result.suppliersCreated, created: result.offersCreated,
      };
    } catch (err) {
      log.warn('Магазин не подключён', { source: providerCode, item, err: err.message });
      return { input: item, ok: false, error: err.message };
    }
  }
}
