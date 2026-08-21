// Маршруты админки: хеш → заголовок. Порядок задаёт порядок пунктов меню.
export const ROUTES = [
  { id: 'dashboard', title: 'Дашборд' },
  { id: 'suppliers', title: 'Поставщики' },
  { id: 'catalog', title: 'Товары' },
  { id: 'offers', title: 'Предложения' },
  { id: 'arbitrage', title: 'Связки' },
  { id: 'flags', title: 'Контроль данных' },
  { id: 'moderation', title: 'Модерация' },
  { id: 'users', title: 'Пользователи' },
  { id: 'plans', title: 'Тарифы' },
  { id: 'promotions', title: 'Реклама' },
  { id: 'content', title: 'Контент бота' },
  { id: 'broadcasts', title: 'Рассылки' },
  { id: 'market', title: 'Аналитика рынка' },
  { id: 'sources', title: 'Источники цен' },
  { id: 'io', title: 'Импорт / экспорт' },
];

export const DEFAULT_ROUTE = 'dashboard';
