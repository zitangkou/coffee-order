#!/usr/bin/env bash
# 不启动容器，验证一键部署配置生成、脚本语法与关键安全门禁。
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

bash -n deploy.sh \
  deploy/setup-docker.sh \
  deploy/init-config.sh \
  deploy/update-env.sh \
  deploy/setup-https.sh \
  deploy/backup.sh \
  deploy/restore-verify.sh \
  deploy/install-backup.sh \
  deploy/install-monitor.sh \
  deploy/monitor.sh

# 在 UTF-8 locale 下，未加花括号的变量紧邻中文标点可能被 Bash 当成更长变量名。
if rg -n '\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7F]' \
  deploy.sh deploy/*.sh scripts/*.sh >/dev/null; then
  echo "[deploy-safety] ✗ shell 变量紧邻非 ASCII 字符，请改用 \${VAR}"
  exit 1
fi

TEMP_ENV="$(mktemp)"
rm -f "$TEMP_ENV"
trap 'rm -f "$TEMP_ENV"' EXIT
ENV_FILE="$TEMP_ENV" bash deploy/init-config.sh >/dev/null

awk -F= '
  BEGIN { ok = 0 }
  $1 == "MYSQL_PASSWORD" && length($2) >= 48 { ok++ }
  $1 == "MYSQL_ROOT_PASSWORD" && length($2) >= 48 { ok++ }
  $1 == "JWT_SECRET" && length($2) >= 64 { ok++ }
  $1 == "INITIAL_ADMIN_PASSWORD" && length($2) >= 32 { ok++ }
  $1 == "INITIALIZE_SEED" && $2 == "true" { ok++ }
  END { exit ok == 5 ? 0 : 1 }
' "$TEMP_ENV"

ENV_FILE="$TEMP_ENV" bash deploy/update-env.sh INITIALIZE_SEED false
awk -F= '$1 == "INITIALIZE_SEED" && $2 == "false" { ok = 1 } END { exit ok ? 0 : 1 }' "$TEMP_ENV"

if rg -q 'MYSQL_(ROOT_)?PASSWORD:-|JWT_SECRET:-' docker-compose.yml; then
  echo "[deploy-safety] ✗ Compose 存在安全配置默认值"
  exit 1
fi
if ! rg -q 'health/ready' deploy.sh || ! rg -q 'deploy/backup.sh' deploy.sh; then
  echo "[deploy-safety] ✗ 一键部署缺少 readiness 或部署前备份"
  exit 1
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose --env-file "$TEMP_ENV" config --quiet
fi

echo "[deploy-safety] ✓ 配置生成、更新幂等、脚本语法与 Compose 安全门禁通过"
