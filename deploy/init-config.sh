#!/usr/bin/env bash
# 创建或补齐生产 .env。只写文件，不在终端输出任何生成值。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
TEMPLATE_FILE="$ROOT_DIR/deploy/.env.example"
NEW_FILE=false

umask 077
if [ ! -f "$ENV_FILE" ]; then
  cp "$TEMPLATE_FILE" "$ENV_FILE"
  NEW_FILE=true
fi

random_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    od -An -N"$bytes" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local temp
  temp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
  awk -F= -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $1 == key { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$temp"
  chmod 600 "$temp"
  mv "$temp" "$ENV_FILE"
}

if [ -z "$(env_value MYSQL_PASSWORD)" ]; then
  set_env_value MYSQL_PASSWORD "$(random_hex 24)"
fi
if [ -z "$(env_value MYSQL_ROOT_PASSWORD)" ]; then
  set_env_value MYSQL_ROOT_PASSWORD "$(random_hex 24)"
fi
if [ -z "$(env_value JWT_SECRET)" ]; then
  set_env_value JWT_SECRET "$(random_hex 32)"
fi
if [ "$NEW_FILE" = true ]; then
  set_env_value INITIALIZE_SEED true
fi
if [ -z "$(env_value INITIAL_ADMIN_PASSWORD)" ] && \
   { [ "$NEW_FILE" = true ] || [ "$(env_value INITIALIZE_SEED)" = "true" ]; }; then
  set_env_value INITIAL_ADMIN_PASSWORD "$(random_hex 16)"
fi

chmod 600 "$ENV_FILE"
echo "[config] 生产配置文件已就绪；生成值仅保存在受限文件中，未输出到终端"
