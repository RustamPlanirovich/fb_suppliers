// Селекторы и атрибуты публичных страниц площадки. Вёрстка источника меняется —
// правится только этот файл, разбор и логика синхронизации остаются нетронутыми.

export const LOT_PAGE = {
  offer: 'a.tc-item',
  title: '.tc-desc-text',
  price: '.tc-price',
  priceValueAttr: 'data-s',      // машинное значение цены, точнее текста
  priceUnit: '.tc-price .unit',
  sellerName: '.media-user-name',
  sellerLink: '.avatar-photo',
  sellerLinkAttr: 'data-href',   // https://funpay.com/users/<id>/
  sellerReviews: '.rating-mini-count',
  sellerStars: '.rating-stars',
  userBlock: '.media-user',
  sellerInfo: '.media-user-info',
  offerIdParam: 'id',            // href: /lots/offer?id=<offerId>
  itemsPerPageAttr: 'data-items-per-page',
  table: '.showcase-table',
};

export const GAMES_PAGE = {
  gameTitle: '.promo-game-item .game-title',
  gameIdAttr: 'data-id',
  nodeLink: 'a',
  nodeList: '.promo-game-item ul a',
};

export const USER_PAGE = {
  name: '.profile h1 .mr4',
  ratingValue: '.rating-value .big',
  paramItem: '.param-item',
  paramTitle: 'h5',
  paramValue: '.text-nowrap',
};

// Атрибуты фильтров лота на строке предложения: data-f-<id> → значение.
export const FILTER_ATTR_PREFIX = 'data-f-';

// Символ валюты на странице → код валюты. Валюта задаётся cookie `cy` (см. funpay.client.js),
// а здесь только проверяется, что страница действительно пришла в ней.
export const CURRENCY_BY_UNIT = { '₽': 'RUB', $: 'USD', '€': 'EUR' };

// Страница раздела содержит все предложения сразу (data-items-per-page — ленивая отрисовка
// на клиенте, не серверная пагинация). Ограничение ниже — предохранитель от аномально
// больших страниц, а не пагинация.
export const PARSE_LIMIT = 5000;
