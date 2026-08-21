# Запуск проекта

> Обновлено: 2026-08-21

Новый разработчик поднимает проект, читая только этот файл.

## Требования

- Node.js LTS (18+)
- PostgreSQL 14+
- Redis 7+
- Токен телеграм-бота от @BotFather (для работы бота; без него API и админка работают)

## Шаги

1. Установить зависимости бэкенда:
   ```bash
   cd server && npm i
   ```
2. Создать конфиг из примера и заполнить:
   ```bash
   cp .env.example .env
   openssl rand -hex 16   # → PGPASSWORD
   openssl rand -hex 32   # → SESSION_SECRET
   # TELEGRAM_BOT_TOKEN — из @BotFather
   ```
3. Создать роль и базу (имя роли и базы = имя проекта):
   ```bash
   psql -d postgres -c "CREATE ROLE fpsuppliers LOGIN PASSWORD '<пароль из .env>';"
   psql -d postgres -c "CREATE DATABASE fpsuppliers OWNER fpsuppliers;"
   ```
4. Применить миграции (создадут схему и стартовые данные: тарифы, площадки, тексты бота):
   ```bash
   npm run migrate
   ```
5. Создать первого администратора (роль `owner`):
   ```bash
   npm run create-admin -- admin@example.com "Имя" "ПарольНеМенее10Символов"
   ```
6. Запустить бэкенд:
   ```bash
   npm run dev          # http://localhost:3000
   ```
7. Запустить админку в другом терминале:
   ```bash
   cd ../admin && npm run dev   # http://localhost:5173
   ```

## Проверка

```bash
curl -s localhost:3000/health
# {"ok":true,"data":{"env":"development"}}
```

Открыть http://localhost:5173, войти под созданным администратором — должен открыться дашборд.

## Переменные окружения

| Переменная | Обязательна | Назначение |
|---|---|---|
| `PORT` | нет | Порт API, по умолчанию 3000 |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | да (кроме host/port) | Подключение к PostgreSQL |
| `REDIS_URL` | нет | Redis, по умолчанию `redis://localhost:6379` |
| `SESSION_SECRET` | да | Подпись сессионных кук админки |
| `CORS_ORIGINS` | нет | Origin'ы админки через запятую; пусто — CORS выключен |
| `TELEGRAM_BOT_TOKEN` | для бота | Токен бота |
| `BOT_ENABLED` | нет | `off` — не поднимать бота (удобно локально) |
| `FUNPAY_SYNC_ENABLED` | нет | `on` — разрешить обращения к площадке за ценами |
| `FUNPAY_CURRENCY` | нет | Валюта витрины площадки: `rub` (по умолчанию), `usd`, `eur` |
| `FUNPAY_BASE_URL` | нет | Базовый адрес площадки |
| `LOG_LEVEL` | нет | `debug` \| `info` \| `warn` \| `error` |
