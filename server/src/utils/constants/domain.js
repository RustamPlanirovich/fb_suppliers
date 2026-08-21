export const SUPPLIER_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  VERIFIED: 'verified',
  RECHECK: 'recheck',
  BLOCKED: 'blocked',
  ARCHIVED: 'archived',
};

export const SUPPLIER_STATUSES = Object.values(SUPPLIER_STATUS);

// Статусы, при которых поставщик виден в боте.
export const PUBLIC_SUPPLIER_STATUSES = [SUPPLIER_STATUS.VERIFIED, SUPPLIER_STATUS.RECHECK];

// 'funpay' — только источник рыночных цен, контакты у таких карточек не хранятся.
export const SUPPLIER_SOURCES = [
  'manual', 'telegram', 'funpay', 'digiseller', 'playerok', 'import', 'user',
];
// Источники-площадки: контакты их продавцов не собираются и не хранятся.
export const MARKETPLACE_SOURCES = ['funpay', 'digiseller', 'playerok'];

export const SORT_FIELDS = {
  RELEVANCE: 'relevance',
  PRICE: 'price',
  SALES: 'sales',
  REVIEWS: 'reviews',
  QUALITY: 'quality',
  RELIABILITY: 'reliability',
  MARGIN: 'margin',
  CREATED: 'created',
};

export const SORT_VALUES = Object.values(SORT_FIELDS);

export const COMPLAINT_REASONS = [
  'closed', 'no_answer', 'wrong_contacts', 'scam', 'price', 'out_of_stock', 'other',
];

export const COMPLAINT_STATUSES = ['new', 'in_progress', 'resolved', 'rejected'];
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];
export const SUBMISSION_TYPES = [
  'new_supplier', 'new_offer', 'price_update', 'out_of_stock', 'supplier_request', 'other',
];
export const SUBMISSION_STATUSES = ['new', 'approved', 'rejected'];

export const PROMO_SLOTS = ['top', 'category', 'search'];

export const ARBITRAGE_MARKS = ['auto', 'good', 'doubtful', 'stale'];

export const FLAG_TYPES = [
  'price_spike_up', 'price_spike_down', 'price_stale', 'offer_removed',
  'source_unreachable', 'price_anomaly', 'supplier_stale_check', 'many_complaints', 'broken_link',
];

export const FLAG_STATUSES = ['open', 'resolved', 'ignored'];

export const ALERT_TYPES = [
  'price_below', 'price_drop_pct', 'margin_above', 'new_supplier', 'sell_price_up',
];

// Пороги автоматических флагов контроля данных.
export const FLAG_THRESHOLDS = {
  PRICE_SPIKE_PCT: 30,
  PRICE_STALE_DAYS: 7,
  SUPPLIER_STALE_CHECK_DAYS: 30,
  COMPLAINTS_LIMIT: 3,
  ANOMALY_DEVIATION_PCT: 70,
};

// Границы уровня конкуренции по числу продавцов на площадке.
export const COMPETITION_BOUNDS = { LOW: 5, MEDIUM: 20 };

// Границы уровня риска связки.
export const RISK_BOUNDS = { PRICE_AGE_HOURS: 72, MIN_RELIABILITY: 3.5, MIN_DEALS: 3 };

export const DUPLICATE_FIELDS = ['phone', 'telegram', 'website', 'email', 'name'];

export const IMPORT_TARGETS = ['suppliers', 'offers'];

export const IMPORT_COLUMNS = {
  suppliers: [
    'name', 'description', 'category', 'source', 'external_url', 'telegram', 'phone',
    'email', 'website', 'quality_score', 'status', 'tags',
  ],
  offers: [
    'supplier', 'product', 'variant', 'title', 'price', 'currency',
    'min_qty', 'stock', 'url', 'external_id',
  ],
};

export const CURRENCY_DEFAULT = 'RUB';

export const PRICE_SOURCES = ['admin', 'parser', 'user', 'import'];

// Возможности тарифа, которые админ включает в подписку.
export const PLAN_FEATURES = {
  searches_per_day: { type: 'number', label: 'Поисков в сутки (0 — без лимита)' },
  favorites_limit: { type: 'number', label: 'Лимит избранного' },
  watchlist_limit: { type: 'number', label: 'Лимит watchlist' },
  alerts_limit: { type: 'number', label: 'Лимит алертов' },
  show_contacts: { type: 'boolean', label: 'Показывать контакты поставщиков' },
  price_history: { type: 'boolean', label: 'История цены' },
  arbitrage: { type: 'boolean', label: 'Сканер связок и маржа' },
  market_analytics: { type: 'boolean', label: 'Аналитика рынка: что выгодно покупать и продавать' },
  export: { type: 'boolean', label: 'Выгрузка результатов' },
  early_alerts: { type: 'boolean', label: 'Ранние уведомления' },
  crm: { type: 'boolean', label: 'Кабинет реселлера' },
  priority_support: { type: 'boolean', label: 'Приоритетная поддержка' },
};

export const PLAN_FEATURE_KEYS = Object.keys(PLAN_FEATURES);
