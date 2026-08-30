#!/usr/bin/env bash
# 服务器发布前只读安全检查；不读取或打印任何密钥、证书及环境变量值。
set -euo pipefail
cd "$(dirname "$0")/.."

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-$(compose_env_value WEB_BASE_URL)}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://nagacoffee.site}"
failures=0

pass() { echo "[security-check] ✓ $1"; }
fail() { echo "[security-check] ✗ $1"; failures=$((failures + 1)); }

docker compose config --quiet && pass "Compose 配置有效" || fail "Compose 配置无效"

if docker compose ps --status running --services | grep -qx mysql; then
  pass "MySQL 容器运行中"
else
  fail "MySQL 容器未运行"
fi

if docker compose ps --status running --services | grep -qx server; then
  pass "API 容器运行中"
else
  fail "API 容器未运行"
fi

if docker port coffee-mysql 2>/dev/null | grep -q .; then
  fail "MySQL 存在宿主机端口映射"
else
  pass "MySQL 未暴露宿主机端口"
fi

if docker port coffee-server 2>/dev/null | grep -q .; then
  fail "API 容器存在直接宿主机端口映射"
else
  pass "API 仅通过内部网关访问"
fi

for container in coffee-server coffee-web; do
  RUN_USER="$(docker inspect --format '{{.Config.User}}' "$container" 2>/dev/null || true)"
  if [ -n "$RUN_USER" ] && [ "$RUN_USER" != "0" ] && [ "$RUN_USER" != "root" ] && [ "$RUN_USER" != "0:0" ]; then
    pass "$container 配置为非 root 用户"
  else
    fail "$container 未配置非 root 用户"
  fi
done

WEB_BIND="$(docker port coffee-web 8080/tcp 2>/dev/null || true)"
if [[ "$WEB_BIND" == 127.0.0.1:* ]]; then
  pass "Web 容器仅绑定回环地址"
else
  fail "Web 容器未限制为 127.0.0.1"
fi

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time 15 "$PUBLIC_BASE_URL/api/health" || true)"
if [ "$HTTP_CODE" = "200" ]; then
  pass "公网 HTTPS API 健康"
else
  fail "公网 HTTPS API 不可用（HTTP ${HTTP_CODE}）"
fi

if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -q 'Status: active'; then
    pass "UFW 已启用"
  else
    fail "UFW 未启用或当前用户无权检查"
  fi
else
  fail "未安装 UFW"
fi

if [ "$failures" -gt 0 ]; then
  echo "[security-check] 共 $failures 项未通过"
  exit 1
fi
echo "[security-check] 全部通过"
