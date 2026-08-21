import { config } from '../../utils/config.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { proxyDispatcher } from '../../utils/http.proxy.js';

const REQUEST_TIMEOUT_MS = 20_000;
const MIN_DELAY_MS = 1500;
const RETRIES = 2;
const RETRY_DELAY_MS = 3000;

const log = logger.child({ component: 'funpay' });

// HTTP-клиент площадки: один запрос за раз, с паузой, таймаутом и повтором.
// Читаются только публичные страницы, авторизация не используется.
export class FunpayClient {
  #lastRequestAt = 0;

  async fetchHtml(url) {
    if (!config.funpay.enabled) {
      throw new AppError('Синхронизация с площадкой выключена (FUNPAY_SYNC_ENABLED)', {
        status: 503, code: 'SYNC_DISABLED',
      });
    }
    let lastError = null;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        return await this.#request(this.#absolute(url));
      } catch (err) {
        lastError = err;
        if (err.code === 'SOURCE_NOT_FOUND') throw err;
        log.warn('Повтор запроса к площадке', { url, attempt: attempt + 1, err: err.message });
        await this.#sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    throw lastError;
  }

  async #request(url) {
    await this.#throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': config.funpay.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru,en;q=0.9',
          // Валюта витрины фиксируется cookie, иначе площадка выбирает её сама.
          Cookie: `cy=${config.funpay.currency}`,
        },
        signal: controller.signal,
        dispatcher: proxyDispatcher(config.funpay.proxyUrl),
      });
      if (response.status === 404) {
        throw new AppError('Раздел не найден на площадке', { status: 404, code: 'SOURCE_NOT_FOUND' });
      }
      if (!response.ok) {
        throw new AppError(`Площадка ответила ${response.status}`, {
          status: 502, code: 'SOURCE_ERROR',
        });
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  #absolute(url) {
    return url.startsWith('http') ? url : `${config.funpay.baseUrl}${url}`;
  }

  nodeUrl(nodeId, kind = 'lots') {
    return `${config.funpay.baseUrl}/${kind}/${nodeId}/`;
  }

  homeUrl() {
    return `${config.funpay.baseUrl}/`;
  }

  userUrl(userId) {
    return `${config.funpay.baseUrl}/users/${userId}/`;
  }

  async #throttle() {
    const wait = MIN_DELAY_MS - (Date.now() - this.#lastRequestAt);
    if (wait > 0) await this.#sleep(wait);
    this.#lastRequestAt = Date.now();
  }

  #sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }
}
