// Тексты-заглушки берутся из БД (content_blocks), здесь — только структура и лимиты.

export const BOT_EVENT = {
  START: 'start',
  SEARCH: 'search',
  CONTACT_OPEN: 'contact_open',
  FAVORITE_ADD: 'favorite_add',
  FAVORITE_REMOVE: 'favorite_remove',
  COMPLAINT: 'complaint',
  REVIEW: 'review',
};

// Префиксы callback_data: `префикс:id`
export const BOT_ACTION = {
  FAVORITE: 'fav',
  UNFAVORITE: 'unfav',
  CONTACTS: 'ct',
  COMPLAIN: 'cmp',
  COMPLAIN_REASON: 'cmpr',
  SORT: 'srt',
  PAGE: 'pg',
  CATEGORY: 'cat',
  CATEGORY_PAGE: 'catpg',
  VARIANT_SUPPLIERS: 'vsup',
  REVIEW: 'rev',
};

export const BOT_LIMITS = {
  RESULTS_PER_PAGE: 5,
  SUPPLIERS_PER_PAGE: 8,
  MAX_QUERY_LENGTH: 100,
  MIN_QUERY_LENGTH: 2,
  BROADCAST_RATE_PER_SEC: 25,
  BROADCAST_CONFIRM_THRESHOLD: 500,
};

export const BOT_STATE = {
  IDLE: 'idle',
  AWAIT_COMPLAINT_TEXT: 'await_complaint_text',
  AWAIT_REVIEW_TEXT: 'await_review_text',
};

export const BOT_EVENT_EXTRA = {
  WATCH_ADD: 'watch_add',
  ALERT_CREATE: 'alert_create',
  CALC: 'calc',
  ARBITRAGE_VIEW: 'arbitrage_view',
  PRICE_HISTORY: 'price_history',
  SUBMISSION: 'submission',
  MARKET_VIEW: 'market_view',
  CATEGORY_VIEW: 'category_view',
};
