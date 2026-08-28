#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_ENV_FILE="$ROOT_DIR/web/.env.production"

public_env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print; exit }' "$PUBLIC_ENV_FILE"
}

VITE_MP_API_BASE_VALUE="${VITE_MP_API_BASE:-$(public_env_value VITE_MP_API_BASE)}"
VITE_ASSET_BASE_VALUE="${VITE_ASSET_BASE:-$(public_env_value VITE_ASSET_BASE)}"
export VITE_MP_API_BASE="$VITE_MP_API_BASE_VALUE"
export VITE_ASSET_BASE="$VITE_ASSET_BASE_VALUE"

echo "[release-check] 部署脚本语法检查"
bash -n "$ROOT_DIR/deploy.sh" \
  "$ROOT_DIR/deploy/backup.sh" \
  "$ROOT_DIR/deploy/restore-verify.sh" \
  "$ROOT_DIR/deploy/security-check.sh" \
  "$ROOT_DIR/deploy/wechat-readiness.sh" \
  "$ROOT_DIR/deploy/install-backup.sh"

echo "[release-check] 前端类型检查"
npm --prefix "$ROOT_DIR/web" run type-check

echo "[release-check] 微信小程序构建"
npm --prefix "$ROOT_DIR/web" run build:mp-weixin

if [[ "${PRODUCTION_RELEASE:-false}" == "true" ]]; then
  if [[ "$VITE_MP_API_BASE_VALUE" != https://* ]]; then
    echo "[release-check] ✗ 正式小程序构建必须配置 HTTPS 的 VITE_MP_API_BASE"
    exit 1
  fi
  if [[ "$VITE_MP_API_BASE_VALUE" == *example.com* ]]; then
    echo "[release-check] ✗ VITE_MP_API_BASE 仍是示例域名"
    exit 1
  fi
  if [[ "$VITE_ASSET_BASE_VALUE" != https://* ]]; then
    echo "[release-check] ✗ 正式小程序构建必须配置 HTTPS 的 VITE_ASSET_BASE"
    exit 1
  fi
fi

echo "[release-check] H5 构建"
npm --prefix "$ROOT_DIR/web" run build:h5

echo "[release-check] 后端构建与安全门禁"
npm --prefix "$ROOT_DIR/server" run security

echo "[release-check] 生产 MySQL schema 校验"
DATABASE_URL="mysql://schema_check:schema_check@localhost:3306/schema_check" \
  npm --prefix "$ROOT_DIR/server" exec -- prisma validate --schema "$ROOT_DIR/server/prisma/schema.mysql.prisma"

if rg -q "pages_admin" "$ROOT_DIR/web/dist/build/mp-weixin"; then
  echo "[release-check] ✗ 微信小程序产物不应包含商家后台"
  exit 1
fi

if rg -q 'auth/guest|/admin/' "$ROOT_DIR/web/dist/build/mp-weixin"; then
  echo "[release-check] ✗ 微信小程序产物不应包含游客登录或商家后台 API"
  exit 1
fi

if rg -q 'http://(localhost|127\.0\.0\.1)|BEGIN (RSA )?PRIVATE KEY|WECHAT_MP_SECRET|WECHAT_API_V3_KEY|MCH_PRIVATE' \
  "$ROOT_DIR/web/dist/build/mp-weixin"; then
  echo "[release-check] ✗ 微信小程序产物包含本地地址或敏感配置标记"
  exit 1
fi

if [[ "${PRODUCTION_RELEASE:-false}" == "true" ]] && \
  ! rg -q 'https://nagacoffee\.site/api' "$ROOT_DIR/web/dist/build/mp-weixin"; then
  echo "[release-check] ✗ 小程序产物未包含正式 API 域名"
  exit 1
fi

if rg -q 'db push|accept-data-loss' "$ROOT_DIR/Dockerfile.server"; then
  echo "[release-check] ✗ 生产容器禁止使用 db push/accept-data-loss"
  exit 1
fi

if [[ "${CHECK_SMOKE:-false}" == "true" ]]; then
  echo "[release-check] 后端冒烟测试"
  npm --prefix "$ROOT_DIR/server" run smoke
fi

echo "[release-check] ✓ 发布检查通过"
