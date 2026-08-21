#!/usr/bin/env bash
# Первичная установка на сервер. Запускать от root на чистой машине с PostgreSQL.
# Использование: bash setup.sh <домен-или-IP> [порт=3100]
set -euo pipefail

APP_DIR=/opt/fpsuppliers
APP_PORT="${2:-3100}"
REPO=https://github.com/RustamPlanirovich/fb_suppliers.git
HOST="${1:-_}"
DB_NAME=fpsuppliers
DB_USER=fpsuppliers

log() { printf '\n=== %s ===\n' "$1"; }

# На части серверов sudo не установлен, зато всё выполняется от root.
psql_admin() { if command -v sudo >/dev/null; then sudo -u postgres "$@"; else su - postgres -c "$(printf '%q ' "$@")"; fi; }

log "Проверка окружения"
command -v psql >/dev/null || { echo "PostgreSQL не найден" >&2; exit 1; }

log "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx redis-server ca-certificates

if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2 --silent

systemctl enable --now redis-server
systemctl enable --now postgresql

log "Код"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$APP_DIR"
fi
cd "$APP_DIR/server"
npm ci --omit=dev --silent

log "База данных"
DB_PASS="$(openssl rand -hex 16)"
psql_admin psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || psql_admin psql -qc "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
psql_admin psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || psql_admin psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
# Пароль задаётся заново при каждом прогоне: старый в .env мог устареть.
psql_admin psql -qc "ALTER ROLE $DB_USER PASSWORD '$DB_PASS';"

log "Конфигурация"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env
  sed -i "s|^PORT=.*|PORT=$APP_PORT|" .env
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=|" .env
  echo "! Впишите TELEGRAM_BOT_TOKEN в $APP_DIR/server/.env"
fi
sed -i "s|^PGPASSWORD=.*|PGPASSWORD=$DB_PASS|" .env
chmod 600 .env

log "Миграции"
npm run migrate

log "Nginx"
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/fpsuppliers
sed -i "s|server_name _;|server_name $HOST;|" /etc/nginx/sites-available/fpsuppliers
ln -sf /etc/nginx/sites-available/fpsuppliers /etc/nginx/sites-enabled/fpsuppliers
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

log "Запуск"
cd "$APP_DIR/server"
pm2 start ecosystem.config.cjs --env production --update-env || pm2 reload ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

log "Готово"
echo "Админка и API: порт $APP_PORT (проксируйте домен на 127.0.0.1:$APP_PORT)"
echo "Проверка: curl -s http://127.0.0.1:$APP_PORT/health"
echo "Дальше:   создать администратора —"
echo "  cd $APP_DIR/server && npm run create-admin -- <email> \"<Имя>\" \"<пароль>\""
