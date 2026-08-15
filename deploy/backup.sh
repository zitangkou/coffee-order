#!/usr/bin/env bash
# Coffee OS MySQL 自动备份脚本：docker compose exec mysqldump + gzip + 保留 N 天
# 用法：bash deploy/backup.sh（可放入 crontab，见 deploy/install-backup.sh）
set -euo pipefail
cd "$(dirname "$0")/.."

# 读取项目 .env（避免密码写死在脚本里）
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/coffee_os_$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose exec -T mysql \
  mysqldump -ucoffee -p"${MYSQL_PASSWORD:-coffee123}" --single-transaction coffee_os \
  | gzip > "$FILE"

# 清理超过保留天数的旧备份
find "$BACKUP_DIR" -name "coffee_os_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "[backup] 完成: $FILE"
