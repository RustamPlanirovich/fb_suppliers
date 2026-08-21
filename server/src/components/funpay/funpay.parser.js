import * as cheerio from 'cheerio';
import {
  LOT_PAGE, FILTER_ATTR_PREFIX, CURRENCY_BY_UNIT, PARSE_LIMIT,
} from './funpay.selectors.js';

// Разбор страницы раздела площадки в список предложений.
// Контакты продавцов не извлекаются — площадка используется как источник цен (ADR 0004).
export class FunpayParser {
  parseNode(html) {
    const $ = cheerio.load(html);
    const offers = [];
    $(LOT_PAGE.offer).each((_, element) => {
      if (offers.length >= PARSE_LIMIT) return false;
      const offer = this.#parseOffer($, $(element));
      if (offer) offers.push(offer);
      return true;
    });
    return {
      offers,
      filters: this.#filterKeys(offers),
      currency: offers[0]?.currency ?? 'RUB',
    };
  }

  #parseOffer($, node) {
    const price = this.#price(node);
    if (price == null) return null;
    const seller = this.#seller($, node);
    return {
      offerId: this.#offerId(node.attr('href')),
      url: node.attr('href') ?? null,
      title: node.find(LOT_PAGE.title).first().text().trim(),
      price,
      currency: this.#currency(node),
      attributes: this.#attributes(node),
      ...seller,
    };
  }

  #offerId(href) {
    if (!href) return null;
    const match = href.match(new RegExp(`[?&]${LOT_PAGE.offerIdParam}=(\\d+)`));
    return match ? match[1] : null;
  }

  // Цена берётся из машинного атрибута; текст — запасной вариант.
  #price(node) {
    const raw = node.find(LOT_PAGE.price).first().attr(LOT_PAGE.priceValueAttr)
      ?? node.find(LOT_PAGE.price).first().text();
    const value = Number(String(raw).replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  }

  #currency(node) {
    const unit = node.find(LOT_PAGE.priceUnit).first().text().trim();
    return CURRENCY_BY_UNIT[unit] ?? 'RUB';
  }

  #seller($, node) {
    const link = node.find(LOT_PAGE.sellerLink).first().attr(LOT_PAGE.sellerLinkAttr) ?? '';
    const idMatch = link.match(/\/users\/(\d+)/);
    const starsClass = node.find(LOT_PAGE.sellerStars).first().attr('class') ?? '';
    const starsMatch = starsClass.match(/rating-(\d)/);
    return {
      sellerId: idMatch ? idMatch[1] : null,
      sellerUrl: link || null,
      sellerName: node.find(LOT_PAGE.sellerName).first().text().trim() || null,
      sellerRating: starsMatch ? Number(starsMatch[1]) : null,
      sellerReviews: this.#int(node.find(LOT_PAGE.sellerReviews).first().text()),
      sellerOnline: (node.find(LOT_PAGE.userBlock).first().attr('class') ?? '').includes('online'),
      sellerInfo: node.find(LOT_PAGE.sellerInfo).first().text().trim() || null,
    };
  }

  // Значения фильтров лота: data-f-time="1 месяц" → { time: '1 месяц' }.
  #attributes(node) {
    const attributes = {};
    for (const [name, value] of Object.entries(node.attr() ?? {})) {
      if (!name.startsWith(FILTER_ATTR_PREFIX)) continue;
      const key = name.slice(FILTER_ATTR_PREFIX.length);
      if (value) attributes[key] = String(value).trim();
    }
    return attributes;
  }

  #filterKeys(offers) {
    const keys = new Set();
    for (const offer of offers) for (const key of Object.keys(offer.attributes)) keys.add(key);
    return [...keys];
  }

  #int(text) {
    const value = Number(String(text).replace(/\D/g, ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
}
