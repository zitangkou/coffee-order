#!/usr/bin/env bash
# 将备份恢复到一次性临时库并验证，绝不覆盖 coffee_os 生产库。
set -euo pipefail
cd "$(dirname "$0")/.."

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

BACKUP_DIR="${BACKUP_DIR:-$(compose_env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'coffee_os_*.sql.gz' -print | sort | tail -n 1)"
fi
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-verify] 未找到备份文件"
  exit 1
fi

gzip -t "$BACKUP_FILE"
if [ -f "$BACKUP_FILE.sha256" ]; then
  sha256sum -c "$BACKUP_FILE.sha256"
fi

VERIFY_DB="coffee_restore_verify_$(date +%Y%m%d%H%M%S)_$$"
if [[ ! "$VERIFY_DB" =~ ^coffee_restore_verify_[0-9_]+$ ]]; then
  echo "[restore-verify] 临时库名称校验失败"
  exit 1
fi

cleanup() {
  docker compose exec -T -e VERIFY_DB="$VERIFY_DB" mysql sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "DROP DATABASE IF EXISTS \`$VERIFY_DB\`"' >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose exec -T -e VERIFY_DB="$VERIFY_DB" mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "CREATE DATABASE \`$VERIFY_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"'

gzip -dc "$BACKUP_FILE" | docker compose exec -T -e VERIFY_DB="$VERIFY_DB" mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$VERIFY_DB"'

TABLE_COUNT="$(docker compose exec -T -e VERIFY_DB="$VERIFY_DB" mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -uroot -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"$VERIFY_DB\""')"
if ! [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]] || [ "$TABLE_COUNT" -lt 10 ]; then
  echo "[restore-verify] 恢复校验失败：业务表数量异常"
  exit 1
fi

echo "[restore-verify] 通过：备份可恢复，临时验证库将自动删除（表数 $TABLE_COUNT）"
