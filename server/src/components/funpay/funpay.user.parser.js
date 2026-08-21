import * as cheerio from 'cheerio';
import { USER_PAGE } from './funpay.selectors.js';

// Профиль продавца площадки: рейтинг и «сколько существует» — без контактных данных.
export class FunpayUserParser {
  parseUser(html) {
    const $ = cheerio.load(html);
    const params = {};
    $(USER_PAGE.paramItem).each((_, element) => {
      const node = $(element);
      const title = node.find(USER_PAGE.paramTitle).first().text().trim();
      const value = node.find(USER_PAGE.paramValue).first().text().replace(/\s+/g, ' ').trim();
      if (title) params[title] = value;
    });
    return {
      name: $(USER_PAGE.name).first().text().trim() || null,
      rating: this.#number($(USER_PAGE.ratingValue).first().text()),
      registeredAt: params['Дата регистрации'] ?? null,
      params,
    };
  }

  #number(text) {
    const value = Number(String(text).replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
}
