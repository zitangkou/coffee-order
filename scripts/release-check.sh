#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_ENV_FILE="$ROOT_DIR/web/.env.production"

public_env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print; exit }' "$PUBLIC_ENV_FILE"
}

VITE_MP_API_BASE_VALUE="${VITE_MP_API_BASE:-$(public_env_value VITE_MP_API_BASE)}"
VITE_ASSET_BASE_VALUE="${VITE_ASSET_BASE:-$(public_env_value VITE_ASSET_BASE)}"
VITE_LEGAL_OPERATOR_NAME_VALUE="${VITE_LEGAL_OPERATOR_NAME:-$(public_env_value VITE_LEGAL_OPERATOR_NAME)}"
VITE_LEGAL_CUSTOMER_SERVICE_VALUE="${VITE_LEGAL_CUSTOMER_SERVICE:-$(public_env_value VITE_LEGAL_CUSTOMER_SERVICE)}"
VITE_LEGAL_STORE_ADDRESS_VALUE="${VITE_LEGAL_STORE_ADDRESS:-$(public_env_value VITE_LEGAL_STORE_ADDRESS)}"
VITE_LEGAL_DATA_RETENTION_VALUE="${VITE_LEGAL_DATA_RETENTION:-$(public_env_value VITE_LEGAL_DATA_RETENTION)}"
export VITE_MP_API_BASE="$VITE_MP_API_BASE_VALUE"
export VITE_ASSET_BASE="$VITE_ASSET_BASE_VALUE"
export VITE_WX_SUBSCRIBE_TEMPLATE_READY="${VITE_WX_SUBSCRIBE_TEMPLATE_READY:-}"
export VITE_LEGAL_OPERATOR_NAME="$VITE_LEGAL_OPERATOR_NAME_VALUE"
export VITE_LEGAL_CUSTOMER_SERVICE="$VITE_LEGAL_CUSTOMER_SERVICE_VALUE"
export VITE_LEGAL_STORE_ADDRESS="$VITE_LEGAL_STORE_ADDRESS_VALUE"
export VITE_LEGAL_DATA_RETENTION="$VITE_LEGAL_DATA_RETENTION_VALUE"

echo "[release-check] 部署脚本语法检查"
bash -n "$ROOT_DIR/deploy.sh" \
  "$ROOT_DIR/deploy/backup.sh" \
  "$ROOT_DIR/deploy/restore-verify.sh" \
  "$ROOT_DIR/deploy/security-check.sh" \
  "$ROOT_DIR/deploy/wechat-readiness.sh" \
  "$ROOT_DIR/deploy/install-backup.sh"

if ! rg -qx 'secrets' "$ROOT_DIR/.dockerignore" || ! rg -qx '\.env' "$ROOT_DIR/.dockerignore"; then
  echo "[release-check] ✗ Docker 构建上下文必须排除 secrets 和根环境文件"
  exit 1
fi

if rg -n 'console\.(log|error|warn)\([^\n]*(process\.env|WECHAT_API_V3_KEY|WECHAT_MP_SECRET)|JSON\.stringify\(process\.env' \
  "$ROOT_DIR/server/src" "$ROOT_DIR/server/scripts" "$ROOT_DIR/web/src" >/dev/null; then
  echo "[release-check] ✗ 源码存在可能输出敏感环境变量的日志"
  exit 1
fi

echo "[release-check] 前端类型检查"
npm --prefix "$ROOT_DIR/web" run type-check

echo "[release-check] 微信小程序构建"
npm --prefix "$ROOT_DIR/web" run build:mp-weixin

if [[ "${FINAL_SUBMISSION:-false}" == "true" && -n "${WECHAT_MP_APPID:-}" ]]; then
  ROOT_DIR="$ROOT_DIR" node --input-type=module -e '
    import fs from "node:fs";
    import path from "node:path";
    const file = path.join(process.env.ROOT_DIR, "web/dist/build/mp-weixin/project.config.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    config.appid = process.env.WECHAT_MP_APPID;
    fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  '
fi

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

if [[ "${FINAL_SUBMISSION:-false}" == "true" ]]; then
  if [[ -z "${VITE_WX_SUBSCRIBE_TEMPLATE_READY:-}" || "${VITE_WX_SUBSCRIBE_TEMPLATE_READY}" == your_* ]]; then
    echo "[release-check] ✗ 最终提审必须通过私密构建环境注入订阅消息模板"
    exit 1
  fi
  if [[ -z "${WECHAT_SUBSCRIBE_TEMPLATE_READY:-}" || \
        "${WECHAT_SUBSCRIBE_TEMPLATE_READY}" != "${VITE_WX_SUBSCRIBE_TEMPLATE_READY}" ]]; then
    echo "[release-check] ✗ 前后端订阅消息模板必须配置且保持一致"
    exit 1
  fi
  for legal_value in \
    "$VITE_LEGAL_OPERATOR_NAME_VALUE" \
    "$VITE_LEGAL_CUSTOMER_SERVICE_VALUE" \
    "$VITE_LEGAL_STORE_ADDRESS_VALUE" \
    "$VITE_LEGAL_DATA_RETENTION_VALUE"; do
    if [[ -z "$legal_value" || "$legal_value" == *待经营者确认* || "$legal_value" == *your_* ]]; then
      echo "[release-check] ✗ 最终提审必须注入完整的公开经营与隐私文本信息"
      exit 1
    fi
  done
fi

echo "[release-check] H5 构建"
npm --prefix "$ROOT_DIR/web" run build:h5

echo "[release-check] 后端构建与安全门禁"
npm --prefix "$ROOT_DIR/server" run security

echo "[release-check] 退款资金状态机"
npm --prefix "$ROOT_DIR/server" run test:refund-state

echo "[release-check] 管理员与生产开关安全"
npm --prefix "$ROOT_DIR/server" run test:auth-safety

echo "[release-check] 下单幂等与取餐码"
npm --prefix "$ROOT_DIR/server" run test:order-safety

echo "[release-check] 支付归属、幂等与待支付恢复"
npm --prefix "$ROOT_DIR/server" run test:payment-safety

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

if [[ "${PRODUCTION_RELEASE:-false}" == "true" ]]; then
  ROOT_DIR="$ROOT_DIR" node --input-type=module -e '
    import fs from "node:fs";
    import path from "node:path";
    const file = path.join(process.env.ROOT_DIR, "web/dist/build/mp-weixin/project.config.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    if (config.setting?.urlCheck !== true) process.exit(1);
  ' || { echo "[release-check] ✗ 正式小程序产物必须开启 URL 合法域名校验"; exit 1; }
fi

if [[ "${FINAL_SUBMISSION:-false}" == "true" ]]; then
  ROOT_DIR="$ROOT_DIR" node --input-type=module -e '
    import fs from "node:fs";
    import path from "node:path";
    const root = process.env.ROOT_DIR;
    const file = path.join(root, "web/dist/build/mp-weixin/project.config.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    const appid = String(config.appid || "");
    if (!appid || appid === "touristappid" || appid.includes("your")) process.exit(1);
    if (config.setting?.urlCheck !== true) process.exit(2);
  ' || { echo "[release-check] ✗ 最终提审产物 AppID 无效或 URL 校验未开启"; exit 1; }
fi

if rg -n '正式提审前，请|用户点击行为后调用|自动调用订阅' \
  "$ROOT_DIR/web/src/pages/legal" "$ROOT_DIR/web/src/pages/order/result.vue" >/dev/null; then
  echo "[release-check] ✗ 小程序页面仍包含草稿法律文本或不合规订阅提示"
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
