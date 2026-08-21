import { PlayerokClient } from '../../playerok/playerok.client.js';

const client = new PlayerokClient();

// Playerok: данные отдаёт только GraphQL, поэтому запросы идут к нему напрямую.
export const playerokProvider = {
  code: 'playerok',
  title: 'Playerok',
  catalogHint: 'Введите slug игры со страницы площадки — например, roblox',
  async games({ q } = {}) {
    const slug = String(q ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug) return [];
    const game = await client.game(slug);
    if (!game) return [];
    return [{
      gameId: game.id,
      name: game.name,
      nodes: (game.categories ?? []).map((category) => ({
        nodeId: `${game.id}:${category.id}`,
        kind: 'category',
        name: category.name,
        url: `https://playerok.com/${game.slug}/${category.slug}`,
      })),
    }];
  },
  async fetchNode({ nodeId }) {
    const [gameId, categoryId] = String(nodeId).split(':');
    return client.categoryOffers(gameId, categoryId);
  },
  nodeUrl: (nodeId) => `https://playerok.com/?category=${String(nodeId).split(':')[1] ?? ''}`,
};
