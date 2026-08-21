import { config } from '../../utils/config.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { proxyDispatcher } from '../../utils/http.proxy.js';

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
        dispatcher: proxyDispatcher(config.digiseller.proxyUrl),
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

  // Администратору неудобно искать числовой ID: принимаем и ссылку на товар,
  // и ссылку на магазин, и сам ID. Из ссылки на товар ID продавца достаётся через его карточку.
  async resolveSeller(input) {
    const text = String(input ?? '').trim();
    const sellerUrl = text.match(/seller\/(\d+)/);
    if (sellerUrl) return { sellerId: sellerUrl[1], sellerName: null };

    const productUrl = text.match(/(?:itm|id_d=|product\/)[^\d]*(\d{4,})/);
    if (productUrl) return this.productSeller(productUrl[1]);

    const digits = text.replace(/\D/g, '');
    if (!digits) return null;
    // ID продавца и ID товара выглядят одинаково, поэтому проверяем по факту:
    // сначала как магазин, и только если товаров нет — как товар.
    if (await this.#hasProducts(digits)) return { sellerId: digits, sellerName: null };
    return (await this.productSeller(digits)) ?? { sellerId: digits, sellerName: null };
  }

  async #hasProducts(sellerId) {
    try {
      const data = await this.#get('/api/shop/products', {
        seller_id: sellerId, category_id: 0, page: 1, rows: 1,
        currency: config.digiseller.currency, lang: config.digiseller.lang,
      });
      return Number(data.totalItems ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async productSeller(productId) {
    try {
      const data = await this.#get(`/api/products/${productId}/data`, {
        lang: config.digiseller.lang, currency: config.digiseller.currency,
      });
      const seller = data.product?.seller;
      if (!seller?.id) return null;
      return { sellerId: String(seller.id), sellerName: seller.name ?? null };
    } catch {
      return null;
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
    let sellerName = null;
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
      // Имя продавца берётся из карточки первого товара: в списке его нет.
      if (!sellerName && products[0]?.id) {
        sellerName = (await this.productSeller(products[0].id))?.sellerName ?? null;
      }
      offers.push(...products.map((product) => this.#toOffer(product, sellerId, sellerName)));
      if (products.length < ROWS_PER_PAGE) break;
    }
    log.debug('Каталог магазина прочитан', { sellerId, categoryId, offers: offers.length });
    return { offers, filters: [], currency: config.digiseller.currency };
  }

  // Магазин Digiseller — это один продавец, поэтому все товары раздела принадлежат ему.
  #toOffer(product, sellerId, sellerName) {
    return {
      offerId: String(product.id),
      url: `https://plati.market/itm/${product.id}`,
      title: product.name,
      price: Number(product.price_rub ?? product.price) || null,
      currency: config.digiseller.currency,
      attributes: {},
      sellerId: String(sellerId),
      sellerUrl: `https://plati.market/seller/${sellerId}`,
      sellerName: sellerName || `Магазин ${sellerId}`,
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
