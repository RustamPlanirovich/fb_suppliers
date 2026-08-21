import { redis } from '../../utils/redis.js';
import { CACHE_TTL, PROJECT } from '../../utils/constants.js';
import { NotFoundError } from '../../utils/errors.js';

const CACHE_KEY = `${PROJECT}:funpay:games`;

// Каталог игр и разделов площадки. Страница тяжёлая, поэтому список кэшируется на сутки.
export class FunpayCatalogService {
  #client;
  #parser;

  constructor(client, parser) {
    this.#client = client;
    this.#parser = parser;
  }

  async games({ refresh = false } = {}) {
    if (!refresh) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }
    const html = await this.#client.fetchHtml(this.#client.homeUrl());
    const games = this.#parser.parseGames(html);
    await redis.set(CACHE_KEY, JSON.stringify(games), 'EX', CACHE_TTL.DAY);
    return games;
  }

  // Поиск по названию игры — админке не нужен весь список из сотен позиций.
  async search(text, limit = 20) {
    const games = await this.games();
    if (!text) return games.slice(0, limit);
    const needle = text.trim().toLowerCase();
    return games.filter((game) => game.name.toLowerCase().includes(needle)).slice(0, limit);
  }

  async findNode(nodeId) {
    const games = await this.games();
    for (const game of games) {
      const node = game.nodes.find((item) => item.nodeId === String(nodeId));
      if (node) return { ...node, gameName: game.name, gameId: game.gameId };
    }
    throw new NotFoundError('Раздел не найден в каталоге площадки');
  }
}
