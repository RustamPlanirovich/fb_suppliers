-- Стартовые данные: площадки, тарифы, слоты рекламы, тексты бота.

INSERT INTO marketplaces (code, name, commission_pct, url)
VALUES
  ('funpay', 'FunPay', 10.00, 'https://funpay.com'),
  ('digiseller', 'Digiseller', 8.00, 'https://digiseller.ru'),
  ('own', 'Свои каналы', 0.00, NULL);

INSERT INTO plans (code, name, description, price, days, features, sort_order, is_active, is_default)
VALUES
  ('free', 'Free', 'Базовый поиск и ограниченное избранное', 0, 36500,
   '{"searches_per_day": 5, "favorites_limit": 10, "watchlist_limit": 3, "alerts_limit": 1,
     "show_contacts": false, "price_history": false, "arbitrage": false, "export": false}'::jsonb,
   0, TRUE, TRUE),
  ('pro', 'Pro', 'Все контакты, сравнение и история цен', 490, 30,
   '{"searches_per_day": 0, "favorites_limit": 200, "watchlist_limit": 30, "alerts_limit": 15,
     "show_contacts": true, "price_history": true, "arbitrage": false, "export": true}'::jsonb,
   10, TRUE, FALSE),
  ('reseller', 'Reseller', 'Сканер связок, маржа, ранние уведомления, аналитика', 1490, 30,
   '{"searches_per_day": 0, "favorites_limit": 1000, "watchlist_limit": 200, "alerts_limit": 100,
     "show_contacts": true, "price_history": true, "arbitrage": true, "export": true,
     "early_alerts": true, "crm": true, "priority_support": true}'::jsonb,
   20, TRUE, FALSE);

INSERT INTO promo_placements (code, name, description, slot, weight, days, price)
VALUES
  ('top_week',       'Топ, 7 дней',       'Закрепление в первых рядах выдачи', 'top', 300, 7,  990),
  ('top_month',      'Топ, 30 дней',      'Закрепление в первых рядах выдачи', 'top', 300, 30, 2990),
  ('category_month', 'Категория, 30 дней','Первое место внутри категории',     'category', 200, 30, 1490);

INSERT INTO content_blocks (key, type, title, body)
VALUES
  ('start', 'text', 'Приветствие',
   'Привет! Напиши название товара — покажу, у кого он есть, по какой цене и какая потенциальная маржа.'),
  ('help', 'text', 'Помощь',
   'Отправь название товара. Кнопки под карточкой: избранное, история цены, калькулятор прибыли, «неактуально / проблема».'),
  ('empty_results', 'text', 'Ничего не найдено',
   'По этому запросу поставщиков пока нет. Запрос сохранён — постараемся пополнить базу.'),
  ('paywall', 'notification', 'Нужна подписка',
   'Эта функция доступна на платном тарифе. Посмотреть тарифы: /plans'),
  ('terms', 'terms', 'Условия подписки',
   'Подписка продлевается вручную. Возврат средств — по запросу в поддержку.'),
  ('disclaimer', 'text', 'Дисклеймер',
   'Цены площадок носят справочный характер. Соблюдай правила площадок: сделки проводятся внутри них.');
