#!/usr/bin/env bash
# Coffee OS MySQL 自动备份脚本：docker compose exec mysqldump + gzip + 保留 N 天
# 用法：bash deploy/backup.sh（可放入 crontab，见 deploy/install-backup.sh）
set -euo pipefail
cd "$(dirname "$0")/.."

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

BACKUP_DIR="${BACKUP_DIR:-$(compose_env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$(compose_env_value BACKUP_RETENTION_DAYS)}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/coffee_os_$STAMP.sql.gz"

umask 077
mkdir -p "$BACKUP_DIR"

docker compose exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -ucoffee --single-transaction --quick --routines --triggers coffee_os' \
  | gzip > "$FILE"

gzip -t "$FILE"
sha256sum "$FILE" > "$FILE.sha256"

# 清理超过保留天数的旧备份
find "$BACKUP_DIR" -name "coffee_os_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "coffee_os_*.sql.gz.sha256" -mtime +"$RETENTION_DAYS" -delete

echo "[backup] 完成并校验压缩完整性: $FILE"
