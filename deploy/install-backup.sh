#!/usr/bin/env bash
# 安装 Coffee OS 数据库每日备份定时任务（每天 03:00）
set -euo pipefail
cd "$(dirname "$0")/.."

SCRIPT_PATH="$(pwd)/deploy/backup.sh"
VERIFY_PATH="$(pwd)/deploy/restore-verify.sh"
LOG_DIR="$(pwd)/var/log"
mkdir -p "$LOG_DIR"
CRON_LINE="0 3 * * * /bin/bash $SCRIPT_PATH >> $LOG_DIR/backup.log 2>&1 # coffee-order-backup"
VERIFY_CRON_LINE="30 4 * * 0 /bin/bash $VERIFY_PATH >> $LOG_DIR/restore-verify.log 2>&1 # coffee-order-restore-verify"

# 完全一致时不重写 crontab，避免重复部署触发不必要的系统权限操作。
CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"
if ! grep -Fqx -- "$CRON_LINE" <<< "$CURRENT_CRONTAB" || \
   ! grep -Fqx -- "$VERIFY_CRON_LINE" <<< "$CURRENT_CRONTAB"; then
  (printf '%s\n' "$CURRENT_CRONTAB" | grep -v "# coffee-order-" || true; \
    echo "$CRON_LINE"; echo "$VERIFY_CRON_LINE") | crontab -
fi

echo "已安装每日 03:00 数据库与上传文件自动备份：$SCRIPT_PATH"
echo "已安装每周日 04:30 自动恢复验证：$VERIFY_PATH"
echo "备份目录默认 var/backups，保留 14 天（可用 BACKUP_DIR/BACKUP_RETENTION_DAYS 覆盖）"
echo "查看任务：crontab -l"
