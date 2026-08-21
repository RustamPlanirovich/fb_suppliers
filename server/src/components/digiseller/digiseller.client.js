import { config } from '../../utils/config.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const TIMEOUT_MS = 20_000;
const MIN_DELAY_MS = 700;
const ROWS_PER_PAGE = 100;
const MAX_PAGES = 20;

const log = logger.child({ component: 'digiseller' });

// Официальный публичный API Digiseller (витрина plati.market).
// Каталог устроен по магазинам: продавец → его категории → его товары.
export class DigisellerClient {
  #lastRequestAt = 0;

  async #get(path, params) {
    if (!config.digiseller.enabled) {
      throw new AppError('Синхронизация с Digiseller выключена (DIGISELLER_SYNC_ENABLED)', {
        status: 503, code: 'SYNC_DISABLED',
      });
    }
    await this.#throttle();
    const url = new URL(`${config.digiseller.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': config.digiseller.userAgent },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(`Digiseller ответил ${response.status}`, {
          status: 502, code: 'SOURCE_ERROR',
        });
      }
      const data = await response.json();
      // Код ответа приходит строкой, поэтому сравнение только после приведения к числу.
      if (data.retval !== undefined && Number(data.retval) !== 0) {
        throw new AppError(`Digiseller: ${data.retdesc || 'ошибка запроса'}`, {
          status: 502, code: 'SOURCE_ERROR',
        });
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async categories(sellerId) {
    const data = await this.#get('/api/categories', {
      seller_id: sellerId, category_id: 0, lang: config.digiseller.lang,
    });
    return this.#flatten(data.category ?? []);
  }

  // Дерево категорий магазина разворачивается в плоский список с путём в названии.
  #flatten(categories, prefix = '') {
    const result = [];
    for (const category of categories) {
      const name = prefix ? `${prefix} → ${category.name}` : category.name;
      result.push({ id: category.id, name });
      if (category.sub?.length) result.push(...this.#flatten(category.sub, name));
    }
    return result;
  }

  // Товары категории: страницами, пока они не кончатся.
  async categoryOffers(sellerId, categoryId) {
    const offers = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data = await this.#get('/api/shop/products', {
        seller_id: sellerId,
        category_id: categoryId,
        page,
        rows: ROWS_PER_PAGE,
        currency: config.digiseller.currency,
        lang: config.digiseller.lang,
      });
      const products = data.product ?? [];
      offers.push(...products.map((product) => this.#toOffer(product, sellerId)));
      if (products.length < ROWS_PER_PAGE) break;
    }
    log.debug('Каталог магазина прочитан', { sellerId, categoryId, offers: offers.length });
    return { offers, filters: [], currency: config.digiseller.currency };
  }

  // Магазин Digiseller — это один продавец, поэтому все товары раздела принадлежат ему.
  #toOffer(product, sellerId) {
    return {
      offerId: String(product.id),
      url: `https://plati.market/itm/${product.id}`,
      title: product.name,
      price: Number(product.price_rub ?? product.price) || null,
      currency: config.digiseller.currency,
      attributes: {},
      sellerId: String(sellerId),
      sellerUrl: `https://plati.market/seller/${sellerId}`,
      sellerName: `Digiseller ${sellerId}`,
      sellerRating: null,
      sellerReviews: null,
      sellerOnline: false,
      sellerInfo: null,
    };
  }

  categoryUrl(sellerId, categoryId) {
    return `https://plati.market/seller/${sellerId}/${categoryId}`;
  }

  async #throttle() {
    const wait = MIN_DELAY_MS - (Date.now() - this.#lastRequestAt);
    if (wait > 0) await new Promise((resolve) => { setTimeout(resolve, wait); });
    this.#lastRequestAt = Date.now();
  }
}
