# API

> Обновлено: 2026-08-21

Базовый префикс — `/api`. Формат ответов единый:

```
успех:  { "ok": true,  "data": ... }
ошибка: { "ok": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

Аутентификация — серверная сессия в Redis, кука `fpsuppliers.sid` (`httpOnly`, `sameSite=lax`).
Все эндпоинты, кроме `/health`, `/api/auth/login` и `/api/auth/bootstrap`, требуют входа.
Роли: `moderator` < `admin` < `owner`; в таблицах ниже указан минимум, если он выше `moderator`.

Списочные эндпоинты принимают `page`, `limit` и возвращают
`{ items, total, page, limit, pages }`.

## Аутентификация — `/api/auth`

| Метод | Путь | Вход | Ответ |
|---|---|---|---|
| POST | `/login` | `email`, `password` | Профиль администратора |
| POST | `/logout` | — | `null` |
| GET | `/me` | — | Профиль текущего администратора |
| POST | `/bootstrap` | `email`, `name`, `password` | Первый администратор (работает, пока таблица пуста) |
| POST | `/password` | `currentPassword`, `newPassword` | `null` |
| GET | `/admins` | — | Список администраторов (admin) |
| POST | `/admins` | `email`, `name`, `password`, `role` | Новый администратор (owner) |
| POST | `/admins/:id/password` | `newPassword` | Сброс пароля (owner) |
| POST | `/admins/:id/active` | `isActive` | Включение/отключение (owner) |

## Поставщики — `/api/suppliers`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/` | Фильтры: `q`, `status`, `source`, `categoryId`, `tagIds`, `qualityMin`, `reliabilityMin`, `variantId`, `isHidden`, `needsCheck`, `staleCheckDays`, `createdFrom/To`, `sort` |
| POST | `/` | Создание карточки |
| GET | `/:id` | Карточка с тегами |
| PATCH | `/:id` | Правка; поле `evidence` попадает в историю |
| POST | `/:id/check` | Подтверждение проверки: фиксируются сотрудник и дата |
| POST | `/:id/refresh-stats` | Пересчёт агрегатов карточки |
| GET | `/:id/history` | История изменений из `audit_log` |
| POST | `/bulk` | Массовые действия (admin): `status`, `category`, `hide`, `show`, `assign_check`, `add_tags`, `delete` |
| GET | `/duplicates` | Дубли по `phone`, `telegram`, `website`, `email`, `name` |
| POST | `/duplicates/merge` | Объединение карточек (admin) |
| DELETE | `/:id` | Удаление (admin) |

Ограничение: для источника `funpay` контактные поля запрещены (ошибка `VALIDATION`).

## Каталог — `/api/catalog`

| Метод | Путь | Комментарий |
|---|---|---|
| GET/POST | `/products` | Список и создание товаров. Список отдаёт агрегаты по вариантам (число вариантов, предложений, поставщиков, минимальная закупка, средняя продажа, лучшая маржа, лучшая конкуренция, спрос); фильтры `marginMin`, `priceMax`, `hasOffers`, сортировка `name\|margin\|offers\|suppliers\|price\|demand\|variants` |
| GET/PATCH/DELETE | `/products/:id` | Карточка товара с вариантами |
| GET/POST | `/variants` | Варианты; фильтры `marginMin`, `competition`, `priceMax`, `hasOffers`, `sort` |
| GET/PATCH/DELETE | `/variants/:id` | Вариант |
| POST | `/variants/:id/refresh-stats` | Пересчёт агрегатов варианта |
| POST | `/variants/refresh-stale` | Пересчёт устаревших агрегатов пачкой |

## Предложения — `/api/offers`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/` | Фильтры: `variantId`, `supplierId`, `priceMin/Max`, `staleDays`, `sort` |
| POST | `/` | Создание оффера |
| GET/PATCH/DELETE | `/:id` | Оффер |
| POST | `/:id/price` | Изменение цены: `price`, `source`, `evidence` — пишется в историю |
| GET | `/:id/history` | История цены с доказательствами |

## Рыночные цены — `/api/market`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/marketplaces` | Площадки и их комиссии |
| PUT | `/marketplaces` | Создание/правка площадки (admin) |
| POST | `/snapshots` | Срез рыночных цен по варианту |
| GET | `/variants/:id/prices` | Последние срезы по площадкам |
| GET | `/variants/:id/series` | Ряды закупки и продажи за период |

## Связки — `/api/arbitrage`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/` | Фильтры: `roiMin`, `profitMin`, `buyMax`, `riskLevel`, `competition`, `adminMark`, `sort` |
| POST | `/recompute` | Пересчёт связок |
| POST | `/:id/mark` | Пометка: `auto`, `good`, `doubtful`, `stale` |

## Контроль данных — `/api/flags`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/` | Открытые флаги |
| GET | `/summary` | Сводка по типам |
| POST | `/resolve` | Закрытие: `ids`, `status` (`resolved`/`ignored`) |
| POST | `/scan` | Ручной запуск скана |

## Модерация — `/api/moderation`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/counts` | Размеры очередей |
| GET | `/:queue` | `complaints`, `reviews`, `deals`, `submissions` |
| POST | `/:queue/:id/resolve` | Решение; одобренная правка пользователя применяется к базе |

## Справочники — `/api/categories`, `/api/tags`

`GET /` (дерево категорий), `POST /`, `PATCH /:id`, `POST /:id/move`, `DELETE /:id`;
теги — `GET/POST/PATCH/DELETE`.

## Пользователи бота — `/api/users`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/` | Фильтры: `q`, `isBlocked`, `hasSubscription`, `planCode`, `activeSince` |
| GET | `/:id` | Карточка с избранным |
| POST | `/:id/block` | Блокировка/разблокировка |

## Подписки — `/api/subscriptions`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/features` | Словарь возможностей для конструктора тарифов |
| GET/POST | `/plans` | Тарифы; `features` — произвольный набор из словаря (admin на запись) |
| PATCH/DELETE | `/plans/:id` | Правка и удаление (admin) |
| POST | `/plans/:id/default` | Тариф по умолчанию (admin) |
| POST | `/grant` | Ручная выдача или продление доступа |
| POST | `/:id/cancel` | Отмена подписки |
| GET | `/users/:id/history` | История подписок пользователя |
| GET/POST | `/payments` | История и ручная регистрация платежа |
| GET/POST | `/promocodes` | Промокоды |
| POST | `/promocodes/:id/active` | Включение/отключение промокода |

## Реклама — `/api/promotions`

`GET /placements`, `PUT /placements` (admin), `GET /`, `POST /` (admin), `POST /:id/stop` (admin).

## Контент — `/api/content`

`GET /`, `PUT /`, `DELETE /:key`, `GET/POST /faq`, `PATCH/DELETE /faq/:id`.

## Рассылки — `/api/broadcasts`

| Метод | Путь | Комментарий |
|---|---|---|
| GET/POST | `/` | Список и создание |
| PATCH | `/:id` | Правка черновика |
| GET | `/:id/estimate` | Охват сегмента и признак необходимости подтверждения |
| POST | `/:id/test` | Тестовая отправка на указанный Telegram ID |
| POST | `/:id/schedule` | Планирование |
| POST | `/:id/start` | Запуск (admin); при охвате ≥ 500 требуется `confirmedTotal` |
| POST | `/:id/cancel` | Отмена |
| GET | `/:id/stats` | Статистика доставки |

## Аналитика — `/api/analytics`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/dashboard` | Сводка за период: `?period=day\|week\|month\|quarter\|year` |
| GET | `/overview` | Витрина дашборда: ряд по дням (`?metric=searches\|contacts\|suppliers\|offers`, `?days=3..30`), лента последних изменений цен, доли товаров, лучшие связки |
| GET | `/opportunities` | «Что выгодно»: фильтры `marginMin/marginMax`, `profitMin`, `priceMin/priceMax`, `competition`, `suppliersMin`, `sellersMax`, `demandMin`, `trendMin/trendMax`, `categoryId`, `q`; сортировка `margin\|profit\|demand\|competition\|trend_down\|trend_up\|suppliers\|price`; `preset` подставляет готовый набор условий |
| GET | `/opportunities/presets` | Наборы условий: `sell` (маржа + низкая конкуренция), `buy` (маржа + падение цены), `rising` (растёт спрос), `falling` (цена упала) |
| GET | `/market` | Экран «что происходит на рынке» |
| GET | `/audit` | История изменений по всем сущностям |

Витрина `overview` отсекает аномальные связки (ROI вне диапазона 5–300% или закупка дешевле 20 ₽):
копеечная цена даёт ROI в тысячи процентов и вытесняет реальные находки. В общем списке
`/api/arbitrage` такие связки остаются.

## Импорт и экспорт — `/api/io`

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/imports` | История заданий |
| POST | `/imports/preview` | multipart `file` + `target` (`suppliers`/`offers`): заголовки, автосопоставление, пример строк, дубли (admin) |
| POST | `/imports/:id/apply` | Применение с подтверждённым `mapping` (admin) |
| GET | `/exports/:target` | `suppliers`, `offers`, `arbitrage`; `?format=xlsx\|csv` |

## Площадка — `/api/funpay`

Требуется роль `admin`. Работает только при `FUNPAY_SYNC_ENABLED=on`.
Официального API у площадки нет — читаются публичные страницы (см. ADR 0006).

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/games` | Каталог площадки: `?q=` — поиск по названию игры, `?refresh=true` — обновить кэш (сутки) |
| GET | `/nodes/:nodeId` | Раздел по числовому id: игра, название, ссылка |
| POST | `/preview` | Предпросмотр без записи: `nodeId`, опц. `variantAttrs`, `titleRules`. Возвращает число предложений и продавцов, доступные фильтры, разбивку на варианты с ценами и признак `needsRules` |
| POST | `/sync` | Загрузка в базу: `nodeId`, `productName`, опц. `categoryId`, `variantAttrs`, `titleRules`, `withSellers`, `sellerStatus` (`draft`/`pending`/`verified`, по умолчанию `pending`) |
| POST | `/sync-batch` | То же для списка разделов (до 20) |
| GET/POST | `/sources` | Разделы, сохранённые на регулярную синхронизацию |
| POST | `/sources/:id/sync` | Обновить раздел сейчас |
| POST | `/sources/:id/active` | Включить/выключить автообновление |
| DELETE | `/sources/:id` | Убрать раздел |
| GET | `/sellers/:externalId` | Профиль продавца площадки: рейтинг и дата регистрации, без контактов |

Что делает `POST /sync` за один вызов:

1. читает страницу раздела и разбирает все предложения;
2. группирует их в варианты — по фильтрам площадки (`data-f-*`) или по правилам из названия;
3. на каждый вариант пишет срез рыночных цен (минимум, медиана, среднее, максимум, число продавцов),
   выбросы отбрасываются по межквартильному размаху;
4. при `withSellers` создаёт карточки продавцов (без контактов) и их предложения,
   оставляя от каждого продавца самое дешёвое предложение в варианте;
5. предложения, пропавшие из выгрузки, снимает с публикации;
6. пересчитывает агрегаты варианта.

Повторный вызов идемпотентен: карточки и цены обновляются, статус карточки, выставленный
администратором, не перетирается.
