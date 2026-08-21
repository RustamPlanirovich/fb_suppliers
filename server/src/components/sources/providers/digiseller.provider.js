import { DigisellerClient } from '../../digiseller/digiseller.client.js';

const client = new DigisellerClient();

// Digiseller (витрина plati.market): официальный публичный API, каталог по магазинам.
// «Игра» здесь — магазин продавца, «раздел» — его категория.
export const digisellerProvider = {
  code: 'digiseller',
  title: 'Digiseller',
  catalogHint: 'Введите ID продавца Digiseller — например, 1',
  async games({ q } = {}) {
    const sellerId = String(q ?? '').replace(/\D/g, '');
    if (!sellerId) return [];
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
    return [{ gameId: sellerId, name: `Магазин ${sellerId}`, nodes }];
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
