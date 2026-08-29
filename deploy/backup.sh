#!/usr/bin/env bash
# Coffee OS 自动备份脚本：MySQL + 上传文件 + 校验和 + 保留 N 天
# 用法：bash deploy/backup.sh（可放入 crontab，见 deploy/install-backup.sh）
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

BACKUP_DIR="${BACKUP_DIR:-$(compose_env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/var/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$(compose_env_value BACKUP_RETENTION_DAYS)}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/coffee_os_$STAMP.sql.gz"
UPLOAD_FILE="$BACKUP_DIR/coffee_uploads_$STAMP.tar.gz"

umask 077
mkdir -p "$BACKUP_DIR"

docker compose exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -ucoffee --single-transaction --quick --routines --triggers coffee_os' \
  | gzip > "$FILE"

gzip -t "$FILE"
sha256sum "$FILE" > "$FILE.sha256"

# 上传目录与数据库使用同一时间戳，恢复时可按备份对配套取用。
docker compose exec -T server tar -C /app/uploads -czf - . > "$UPLOAD_FILE"
gzip -t "$UPLOAD_FILE"
tar -tzf "$UPLOAD_FILE" >/dev/null
sha256sum "$UPLOAD_FILE" > "$UPLOAD_FILE.sha256"

# 清理超过保留天数的旧备份
find "$BACKUP_DIR" -name "coffee_os_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "coffee_os_*.sql.gz.sha256" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "coffee_uploads_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "coffee_uploads_*.tar.gz.sha256" -mtime +"$RETENTION_DAYS" -delete

echo "[backup] 数据库与上传文件备份完成，并通过压缩包及校验和验证"
