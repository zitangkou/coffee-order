#!/usr/bin/env bash
# 每 5 分钟执行一次只读监控；失败由主机日志/云监控采集告警。
set -euo pipefail
cd "$(dirname "$0")/.."

MONITOR_PATH="$(pwd)/deploy/monitor.sh"
LOG_DIR="$(pwd)/var/log"
mkdir -p "$LOG_DIR"
CRON_LINE="*/5 * * * * /bin/bash $MONITOR_PATH >> $LOG_DIR/monitor.log 2>&1 # coffee-order-monitor"

CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"
if ! grep -Fqx -- "$CRON_LINE" <<< "$CURRENT_CRONTAB"; then
  (printf '%s\n' "$CURRENT_CRONTAB" | grep -v "# coffee-order-monitor" || true; \
    echo "$CRON_LINE") | crontab -
fi

echo "已安装每 5 分钟运行监控：$MONITOR_PATH"
echo "请在腾讯云监控或日志服务中为脚本非零退出/日志中的未通过配置告警。"
