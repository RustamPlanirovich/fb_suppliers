import { DigisellerClient } from '../../digiseller/digiseller.client.js';

const client = new DigisellerClient();

// Digiseller (витрина plati.market): официальный публичный API, каталог по магазинам.
// «Игра» здесь — магазин продавца, «раздел» — его категория.
export const digisellerProvider = {
  code: 'digiseller',
  title: 'Digiseller',
  catalogHint: 'ID продавца или ссылка на его товар с plati.market',
  async games({ q } = {}) {
    const resolved = await client.resolveSeller(q);
    if (!resolved) return [];
    const { sellerId, sellerName } = resolved;
    const categories = await client.categories(sellerId);
    // У магазина может не быть категорий — тогда доступен весь каталог целиком.
    const nodes = [{
      nodeId: `${sellerId}:0`,
      kind: 'category',
      name: 'Весь каталог',
      url: client.categoryUrl(sellerId, 0),
    }];
    for (const category of categories) {
      nodes.push({
        nodeId: `${sellerId}:${category.id}`,
        kind: 'category',
        name: category.name,
        url: client.categoryUrl(sellerId, category.id),
      });
    }
    return [{ gameId: sellerId, name: sellerName || `Магазин ${sellerId}`, nodes }];
  },
  async fetchNode({ nodeId }) {
    const [sellerId, categoryId] = String(nodeId).split(':');
    return client.categoryOffers(sellerId, categoryId ?? '0');
  },
  nodeUrl: (nodeId) => {
    const [sellerId, categoryId] = String(nodeId).split(':');
    return client.categoryUrl(sellerId, categoryId ?? '0');
  },
};
