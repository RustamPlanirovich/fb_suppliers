// Человеческие названия статусов и типов. Значения совпадают с бэкендом.
export const SUPPLIER_STATUS_LABELS = {
  draft: 'Черновик',
  pending: 'На проверке',
  verified: 'Проверен',
  recheck: 'Требует перепроверки',
  blocked: 'Заблокирован',
  archived: 'Архив',
};

export const SUPPLIER_SOURCE_LABELS = {
  manual: 'Вручную',
  telegram: 'Telegram',
  funpay: 'Площадка',
  import: 'Импорт',
  user: 'От пользователя',
};

export const COMPLAINT_REASON_LABELS = {
  closed: 'Закрылся',
  no_answer: 'Не отвечает',
  wrong_contacts: 'Неверные контакты',
  scam: 'Обман',
  price: 'Цена не та',
  out_of_stock: 'Товар закончился',
  other: 'Другое',
};

export const SUBMISSION_TYPE_LABELS = {
  new_supplier: 'Новый поставщик',
  new_offer: 'Новое предложение',
  price_update: 'Обновление цены',
  out_of_stock: 'Товар закончился',
  supplier_request: 'Запрос «найди поставщика»',
  other: 'Другое',
};

export const FLAG_TYPE_LABELS = {
  price_spike_up: 'Цена резко выросла',
  price_spike_down: 'Цена резко упала',
  price_stale: 'Цена не обновлялась',
  offer_removed: 'Предложение снято',
  source_unreachable: 'Источник недоступен',
  price_anomaly: 'Аномальная цена',
  supplier_stale_check: 'Давно не проверялся',
  many_complaints: 'Много жалоб',
  broken_link: 'Битая ссылка',
};

export const LEVEL_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая' };
export const RISK_LABELS = { low: 'низкий', medium: 'средний', high: 'высокий' };
export const ARBITRAGE_MARK_LABELS = {
  auto: 'Авто', good: 'Хорошая', doubtful: 'Сомнительная', stale: 'Неактуальная',
};

export const QUEUE_LABELS = {
  complaints: 'Жалобы',
  reviews: 'Отзывы',
  submissions: 'Правки пользователей',
  deals: 'Подтверждения сделок',
};
