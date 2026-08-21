#!/usr/bin/env bash
# Перенос базы с рабочей машины на сервер.
# Запускать ЛОКАЛЬНО: bash restore-db.sh <пользователь@сервер>
set -euo pipefail

TARGET="${1:?Укажите цель: user@host}"
DUMP=/tmp/fpsuppliers.dump
APP_DIR=/opt/fpsuppliers

echo "=== Снимаю дамп локальной базы ==="
pg_dump -U fpsuppliers -h localhost -Fc fpsuppliers -f "$DUMP"
ls -lh "$DUMP"

echo "=== Копирую на сервер ==="
scp "$DUMP" "$TARGET:/tmp/fpsuppliers.dump"

echo "=== Восстанавливаю ==="
# Приложение останавливается на время восстановления: иначе фоновые задачи
# пишут в базу параллельно с накатом дампа.
ssh "$TARGET" bash -s <<'REMOTE'
set -euo pipefail
pm2 stop fpsuppliers || true
sudo -u postgres psql -qc "DROP DATABASE IF EXISTS fpsuppliers;"
sudo -u postgres psql -qc "CREATE DATABASE fpsuppliers OWNER fpsuppliers;"
sudo -u postgres pg_restore -d fpsuppliers --no-owner --role=fpsuppliers /tmp/fpsuppliers.dump
sudo -u postgres psql -d fpsuppliers -qc "GRANT ALL ON ALL TABLES IN SCHEMA public TO fpsuppliers;"
sudo -u postgres psql -d fpsuppliers -qc "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO fpsuppliers;"
rm -f /tmp/fpsuppliers.dump
cd /opt/fpsuppliers/server && npm run migrate
pm2 start fpsuppliers || pm2 reload fpsuppliers
REMOTE

echo "=== Проверка ==="
ssh "$TARGET" "sudo -u postgres psql -d fpsuppliers -tAc \"SELECT 'поставщиков: ' || count(*) FROM suppliers\""
