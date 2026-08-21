import { config } from '../../utils/config.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { proxyDispatcher } from '../../utils/http.proxy.js';
import { GAME_QUERY, ITEMS_QUERY } from './playerok.queries.js';

const TIMEOUT_MS = 25_000;
const MIN_DELAY_MS = 1800;
const RETRIES = 2;
const RETRY_DELAY_MS = 15_000;
// Площадка не отдаёт больше 24 позиций за запрос — её собственный клиент просит столько же.
const PAGE_SIZE = 24;
// Предохранитель: категория может содержать десятки тысяч лотов, а каждый запрос ~1 секунда.
const MAX_PAGES = 42;

const log = logger.child({ component: 'playerok' });

// Playerok отдаёт данные только через GraphQL: витрина собирается на клиенте.
// Заголовок apollo-require-preflight обязателен — без него сервер отвергает запрос как CSRF.
export class PlayerokClient {
  #lastRequestAt = 0;

  // Площадка ограничивает частоту запросов: при отказе ждём и повторяем.
  async #query(operationName, query, variables) {
    let lastError = null;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        return await this.#request(operationName, query, variables);
      } catch (err) {
        lastError = err;
        if (!/Слишком много попыток/i.test(err.message)) throw err;
        log.warn('Площадка ограничила частоту, жду', { operationName, attempt: attempt + 1 });
        await new Promise((resolve) => { setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)); });
      }
    }
    throw lastError;
  }

  async #request(operationName, query, variables) {
    if (!config.playerok.enabled) {
      throw new AppError('Синхронизация с Playerok выключена (PLAYEROK_SYNC_ENABLED)', {
        status: 503, code: 'SYNC_DISABLED',
      });
    }
    await this.#throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${config.playerok.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'apollo-require-preflight': 'true',
          'apollographql-client-name': 'web',
          origin: config.playerok.baseUrl,
          referer: `${config.playerok.baseUrl}/`,
          'user-agent': config.playerok.userAgent,
        },
        body: JSON.stringify({ operationName, query, variables }),
        signal: controller.signal,
        dispatcher: proxyDispatcher(config.playerok.proxyUrl),
      });
      // Площадка закрыта DDoS-Guard: с заблокированного IP приходит HTML, а не JSON.
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new AppError(
          response.status === 403
            ? 'Playerok заблокировал запрос по IP. Укажите PLAYEROK_PROXY_URL — прокси в разрешённом регионе'
            : `Playerok ответил ${response.status}`,
          { status: 502, code: 'SOURCE_BLOCKED' },
        );
      }
      const data = await response.json();
      if (data.errors?.length) {
        throw new AppError(`Playerok: ${data.errors[0].message}`, {
          status: 502, code: 'SOURCE_ERROR',
        });
      }
      return data.data;
    } finally {
      clearTimeout(timer);
    }
  }

  async game(slug) {
    const data = await this.#query('GamePage', GAME_QUERY, { slug });
    return data?.game ?? null;
  }

  // Лоты категории: курсорная постраничная выборка до конца или до предохранителя.
  async categoryOffers(gameId, categoryId) {
    const offers = [];
    let cursor = null;
    let truncated = false;
    let total = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await this.#query('items', ITEMS_QUERY, {
        pagination: { first: PAGE_SIZE, ...(cursor ? { after: cursor } : {}) },
        filter: { gameId, gameCategoryId: categoryId, status: ['APPROVED'] },
      });
      const items = data?.items;
      if (!items?.edges?.length) break;
      total = items.totalCount ?? total;
      offers.push(...items.edges.map((edge) => this.#toOffer(edge.node)));
      if (!items.pageInfo?.hasNextPage) break;
      cursor = items.pageInfo.endCursor;
      truncated = page === MAX_PAGES - 1;
    }
    if (truncated) {
      log.warn('Категория прочитана частично', { gameId, categoryId, read: offers.length, total });
    }
    log.debug('Категория площадки прочитана', { gameId, categoryId, offers: offers.length });
    return { offers, filters: [], currency: 'RUB', truncated, sourceTotal: total };
  }

  #toOffer(node) {
    return {
      offerId: String(node.id),
      url: `${config.playerok.baseUrl}/products/${node.slug}`,
      title: node.name,
      price: Number(node.price) || null,
      currency: 'RUB',
      attributes: {},
      sellerId: String(node.user?.id ?? node.user?.username ?? ''),
      sellerName: node.user?.username ?? null,
      sellerUrl: node.user?.username
        ? `${config.playerok.baseUrl}/profile/${node.user.username}`
        : null,
      sellerRating: null,
      sellerReviews: null,
      sellerOnline: false,
      sellerInfo: null,
    };
  }

  async #throttle() {
    const wait = MIN_DELAY_MS - (Date.now() - this.#lastRequestAt);
    if (wait > 0) await new Promise((resolve) => { setTimeout(resolve, wait); });
    this.#lastRequestAt = Date.now();
  }
}
