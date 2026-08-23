#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[release-check] 前端类型检查"
npm --prefix "$ROOT_DIR/web" run type-check

echo "[release-check] 微信小程序构建"
npm --prefix "$ROOT_DIR/web" run build:mp-weixin

echo "[release-check] H5 构建"
npm --prefix "$ROOT_DIR/web" run build:h5

echo "[release-check] 后端构建与安全门禁"
npm --prefix "$ROOT_DIR/server" run security

if [[ "${CHECK_SMOKE:-false}" == "true" ]]; then
  echo "[release-check] 后端冒烟测试"
  npm --prefix "$ROOT_DIR/server" run smoke
fi

echo "[release-check] ✓ 发布检查通过"
