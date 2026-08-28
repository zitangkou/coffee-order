#!/usr/bin/env bash
# 在运行中的 API 容器内做微信配置就绪检查；仅输出 ready/not-ready。
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T server npm run readiness:wechat
