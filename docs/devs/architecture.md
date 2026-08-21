# Архитектура

> Обновлено: 2026-08-21

## Обзор

fpsuppliers — инструмент реселлера цифровых товаров: телеграм-бот отвечает на вопрос «что купить,
где дешевле, где продать дороже и сколько я заработаю», админка ведёт базу поставщиков, каталог
товаров, цены и связки. Система состоит из двух развёртываний: бэкенд `server/` (Express + бот
+ планировщик в одном процессе) и статическая админка `admin/` (HTML + vanilla JS).

## Компоненты

| Компонент | Назначение | Код |
|---|---|---|
| auth | Администраторы, сессии, роли | `server/src/components/auth/` |
| suppliers | Карточки поставщиков, статусы, проверка, дубли, массовые действия | `server/src/components/suppliers/` |
| catalog | Товары → варианты → офферы → история цены → рыночные цены площадок | `server/src/components/catalog/` |
| arbitrage | Расчёт связок «купить → продать»: прибыль, ROI, риск | `server/src/components/arbitrage/` |
| flags | Автофлаги контроля данных и очередь «что разгрести» | `server/src/components/flags/` |
| moderation | Очереди: жалобы, отзывы, подтверждения сделок, правки пользователей | `server/src/components/moderation/` |
| search | Поиск для бота, журнал запросов, приоритет оплаченных размещений | `server/src/components/search/` |
| bot | Телеграм-бот: поиск, карточки связок, калькулятор, watchlist, алерты, CRM | `server/src/components/bot/` |
| alerts | Условные уведомления пользователей и их рассылка | `server/src/components/alerts/` |
| users | Пользователи бота, избранное, watchlist, позиции реселлера | `server/src/components/users/` |
| subscriptions | Гибкие тарифы (features в JSONB), подписки, платежи, промокоды, доступы | `server/src/components/subscriptions/` |
| promotions | Платное размещение в «топе» и скидки за рекламу | `server/src/components/promotions/` |
| content | Тексты бота, баннеры, FAQ | `server/src/components/content/` |
| broadcasts | Рассылки: сегмент, тест, запуск с ограничением скорости | `server/src/components/broadcasts/` |
| analytics | Дашборд и экран «что происходит на рынке» | `server/src/components/analytics/` |
| io | Импорт Excel/CSV с сопоставлением колонок и выгрузки | `server/src/components/io/` |
| sources | Общая синхронизация источников: разбор раздела → варианты → срез цен → карточки | `server/src/components/sources/` |
| funpay | Провайдер FunPay: каталог и разбор публичных страниц | `server/src/components/funpay/` |
| digiseller | Провайдер Digiseller: официальный публичный API витрины plati.market | `server/src/components/digiseller/` |
| playerok | Провайдер Playerok: данные через их GraphQL | `server/src/components/playerok/` |

Каждый компонент разложен на `*.router.js` (HTTP), `*.service.js` (логика), `*.repository.js` (SQL).

## Поток данных

1. Администратор или импорт заводит **поставщика** и его **офферы** на варианты товаров;
   раздел площадки может создать их пачкой (товар, варианты, карточки продавцов, цены).
2. Парсер площадки или ручной ввод кладёт **срез рыночных цен** (`market_prices`).
3. Фоновая задача пересчитывает **агрегаты варианта**: закупка, продажа, маржа, конкуренция, тренд.
4. Фоновая задача строит **связки** (`arbitrage_links`): для каждого оффера и площадки считаются
   прибыль, ROI, свежесть цены и уровень риска.
5. Бот отвечает пользователю карточкой связки; события пишутся в `bot_events` и `search_queries`.
6. Аналитика и очереди модерации собираются из этих же таблиц.

## Данные

Схема меняется только миграциями в `server/migrations/`.

| Область | Таблицы |
|---|---|
| Администрирование | `admins`, `audit_log` |
| Справочники | `categories`, `tags`, `marketplaces` |
| Поставщики | `suppliers`, `supplier_tags` |
| Каталог | `products`, `product_variants`, `product_aliases`, `offers`, `offer_price_history`, `market_prices` |
| Пользователи бота | `bot_users`, `favorites`, `watchlist`, `bot_events`, `search_queries` |
| Модерация | `reviews`, `complaints`, `deal_confirmations`, `submissions` |
| Реселлер | `arbitrage_links`, `alerts`, `alert_hits`, `reseller_positions` |
| Контроль | `data_flags` |
| Деньги | `plans`, `subscriptions`, `promo_codes`, `payments`, `promo_placements`, `promotions` |
| Контент | `content_blocks`, `faq_entries`, `broadcasts`, `broadcast_deliveries` |
| Импорт | `import_jobs`, `source_nodes` |

Ключевые особенности схемы:
- Поиск — по `tsvector` (`russian` + `simple`), обновляется триггерами, плюс словарь
  синонимов `product_aliases` и нечёткое совпадение по триграммам (`pg_trgm`).
- Любая правка цены пишется в `offer_price_history` вместе с источником и доказательством.
- Любая правка сущности пишется в `audit_log`: кто, когда, что, на основании чего.
- У карточек с источником `funpay` контакты запрещены ограничением БД — см. ADR 0004.

## Внешние зависимости

- PostgreSQL — источник истины.
- Redis — сессии админки, кэш дашборда и контента, состояние диалога бота, суточные квоты, блокировки рассылок.
- Telegram Bot API (`telegraf`) — бот, алерты, рассылки.
- Площадки FunPay, Digiseller и Playerok — только чтение публичных данных без авторизации
  (см. ADR 0004, 0006 и 0007). Контакты их продавцов не собираются — запрет закреплён в БД.

## Фоновые процессы

Планировщик `server/src/jobs/`, периоды — в `jobs/schedule.js`.

| Задача | Период | Что делает |
|---|---|---|
| `variantStats` | 15 мин | Пересчёт агрегатов устаревших вариантов |
| `arbitrage` | 30 мин | Пересчёт связок и деактивация протухших |
| `alerts` | 20 мин | Проверка условий алертов и отправка уведомлений |
| `flags` | 60 мин | Скан данных: устаревшие цены и проверки, жалобы, снятые офферы |
| `subscriptions` | 60 мин | Перевод истёкших подписок в `expired` |
| `broadcasts` | 1 мин | Запуск отложенных рассылок |
| `sourceSync` | 3 ч | Обновление цен по сохранённым разделам площадки (по 5 за прогон) |
