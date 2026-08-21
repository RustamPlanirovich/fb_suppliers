import * as cheerio from 'cheerio';
import { GAMES_PAGE } from './funpay.selectors.js';

// Разбор главной страницы площадки: игры и их разделы.
// Нужен, чтобы администратор выбирал раздел из списка, а не искал числовой id руками.
export class FunpayCatalogParser {
  parseGames(html) {
    const $ = cheerio.load(html);
    const games = new Map();
    $(GAMES_PAGE.gameTitle).each((_, element) => {
      const node = $(element);
      const link = node.find(GAMES_PAGE.nodeLink).first();
      const gameId = node.attr(GAMES_PAGE.gameIdAttr);
      const name = link.text().trim();
      if (!gameId || !name || games.has(gameId)) return;
      games.set(gameId, { gameId, name, nodes: this.#nodes($, node.parent()) });
    });
    return [...games.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // Разделы игры: «Аккаунты», «Premium», «Ключи» — каждый со своим числовым id.
  #nodes($, container) {
    const nodes = [];
    container.find(GAMES_PAGE.nodeList).each((_, element) => {
      const link = $(element);
      const href = link.attr('href') ?? '';
      const match = href.match(/\/(lots|chips)\/(\d+)\//);
      if (!match) return;
      nodes.push({
        nodeId: match[2],
        kind: match[1],
        name: link.text().trim(),
        url: href,
      });
    });
    return nodes;
  }
}
