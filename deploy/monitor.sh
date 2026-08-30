#!/usr/bin/env bash
# 只读运行监控：容器健康、数据库就绪、公网 HTTPS、磁盘和备份新鲜度。
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-$(compose_env_value WEB_BASE_URL)}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://nagacoffee.site}"
BACKUP_DIR="${BACKUP_DIR:-$(compose_env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/var/backups}"
failures=0

pass() { echo "[monitor] ✓ $1"; }
fail() { echo "[monitor] ✗ $1"; failures=$((failures + 1)); }

for service in mysql server web; do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "coffee-$service" 2>/dev/null || true)"
  if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
    pass "$service 容器健康"
  else
    fail "$service 容器不健康"
  fi
done

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time 15 "$PUBLIC_BASE_URL/api/health/ready" || true)"
if [ "$HTTP_CODE" = "200" ]; then
  pass "公网 API 与数据库就绪"
else
  fail "公网 API 未就绪（HTTP ${HTTP_CODE}）"
fi

DISK_USE="$(df -P . | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')"
if [[ "$DISK_USE" =~ ^[0-9]+$ ]] && [ "$DISK_USE" -lt 85 ]; then
  pass "磁盘使用率低于 85%"
else
  fail "磁盘使用率达到阈值"
fi

if find "$BACKUP_DIR" -maxdepth 1 -type f -name 'coffee_os_*.sql.gz' -mmin -1800 -print -quit 2>/dev/null | grep -q .; then
  pass "30 小时内存在数据库备份"
else
  fail "数据库备份超过 30 小时或不存在"
fi
if find "$BACKUP_DIR" -maxdepth 1 -type f -name 'coffee_uploads_*.tar.gz' -mmin -1800 -print -quit 2>/dev/null | grep -q .; then
  pass "30 小时内存在上传文件备份"
else
  fail "上传文件备份超过 30 小时或不存在"
fi

if [ "$failures" -gt 0 ]; then
  echo "[monitor] 共 $failures 项未通过"
  exit 1
fi
echo "[monitor] 全部通过"
