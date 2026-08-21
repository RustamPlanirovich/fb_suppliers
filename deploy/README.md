# Развёртывание

Файлы этой папки переносят проект на сервер.

| Файл | Что делает |
|---|---|
| `setup.sh` | Первичная установка: пакеты, Node, pm2, Redis, nginx, БД, миграции, запуск |
| `nginx.conf` | Админка статикой, `/api` проксируется в приложение на порт 3000 |
| `restore-db.sh` | Переносит базу с рабочей машины на сервер |

## Порядок

```bash
# 1. На сервере (от root)
git clone https://github.com/RustamPlanirovich/fb_suppliers.git /opt/fpsuppliers
bash /opt/fpsuppliers/deploy/setup.sh 155.212.165.204

# 2. Вписать токен бота
nano /opt/fpsuppliers/server/.env     # TELEGRAM_BOT_TOKEN=...
pm2 reload fpsuppliers

# 3. Перенести базу (запускается на рабочей машине)
bash deploy/restore-db.sh root@155.212.165.204

# 4. Создать администратора, если база переносилась не целиком
cd /opt/fpsuppliers/server && npm run create-admin -- <email> "<Имя>" "<пароль>"
```

## Важно про бота

Телеграм разрешает long polling только одному процессу на токен. Перед запуском на сервере
остановите локальный процесс, иначе оба будут получать ошибку 409 и терять сообщения:

```bash
# на рабочей машине
pkill -f "src/index.js"      # или pm2 stop fpsuppliers
```

## Обновление

```bash
cd /opt/fpsuppliers && git pull && cd server && npm ci --omit=dev && npm run migrate
pm2 reload fpsuppliers
```
