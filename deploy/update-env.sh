#!/usr/bin/env bash
# 安全更新单个 .env 字段，不打印文件内容。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
KEY="${1:-}"
VALUE="${2:-}"

if [[ ! "$KEY" =~ ^[A-Z][A-Z0-9_]*$ ]] || [ ! -f "$ENV_FILE" ]; then
  echo "[config] 无法更新配置字段"
  exit 1
fi

umask 077
TEMP_FILE="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
awk -F= -v key="$KEY" -v value="$VALUE" '
  BEGIN { found = 0 }
  $1 == key { print key "=" value; found = 1; next }
  { print }
  END { if (!found) print key "=" value }
' "$ENV_FILE" > "$TEMP_FILE"
chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$ENV_FILE"
