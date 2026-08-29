#!/usr/bin/env bash
# 安装 Coffee OS 数据库每日备份定时任务（每天 03:00）
set -euo pipefail
cd "$(dirname "$0")/.."

SCRIPT_PATH="$(pwd)/deploy/backup.sh"
VERIFY_PATH="$(pwd)/deploy/restore-verify.sh"
CRON_LINE="0 3 * * * /bin/bash $SCRIPT_PATH >> /var/log/coffee-backup.log 2>&1 # coffee-order-backup"
VERIFY_CRON_LINE="30 4 * * 0 /bin/bash $VERIFY_PATH >> /var/log/coffee-restore-verify.log 2>&1 # coffee-order-restore-verify"

# 避免重复安装：先移除本项目已有任务。
(crontab -l 2>/dev/null | grep -v "# coffee-order-" || true; echo "$CRON_LINE"; echo "$VERIFY_CRON_LINE") | crontab -

echo "已安装每日 03:00 数据库与上传文件自动备份：$SCRIPT_PATH"
echo "已安装每周日 04:30 自动恢复验证：$VERIFY_PATH"
echo "备份目录默认 /opt/backups，保留 14 天（可用 BACKUP_DIR/BACKUP_RETENTION_DAYS 覆盖）"
echo "查看任务：crontab -l"
