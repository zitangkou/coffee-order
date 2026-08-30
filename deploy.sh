#!/usr/bin/env bash
# Coffee Order 一键部署：安全配置、构建、迁移、初始化、健康验证及维护任务。
set -Eeuo pipefail
cd "$(dirname "$0")"

CURRENT_STAGE="启动前检查"
on_error() {
  local code=$?
  echo ""
  echo "[deploy] 部署失败，阶段：${CURRENT_STAGE}（退出码 ${code}）"
  echo "[deploy] 未自动输出应用日志，避免意外暴露业务信息。可手动执行："
  echo "  docker compose ps"
  echo "  docker compose logs --tail=100 server"
  exit "$code"
}
trap on_error ERR

WITH_HTTPS=false
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --with-https) WITH_HTTPS=true ;;
    --skip-build) SKIP_BUILD=true ;;
    *) echo "未知参数：$arg"; exit 2 ;;
  esac
done

bash deploy/init-config.sh

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 Docker / Docker Compose，开始自动初始化"
  CURRENT_STAGE="Docker 环境初始化"
  bash deploy/setup-docker.sh
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker / Docker Compose 自动初始化未完成"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon 未运行或当前用户无访问权限；如刚安装 Docker，请重新登录后再执行 ./deploy.sh"
  exit 1
fi
for command_name in curl awk; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "缺少必要命令：$command_name"
    exit 1
  fi
done

# Docker Compose 会读取 .env，但不会把值导入当前 shell；通过 Compose 自身解析，
# 避免直接 source 含特殊字符的生产密码文件。
compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}
BASELINE_EXISTING_DB_VALUE="${BASELINE_EXISTING_DB:-$(compose_env_value BASELINE_EXISTING_DB)}"
INITIALIZE_SEED_VALUE="${INITIALIZE_SEED:-$(compose_env_value INITIALIZE_SEED)}"
HTTP_PORT_VALUE="${HTTP_PORT:-$(compose_env_value HTTP_PORT)}"
ADMIN_HTTP_PORT_VALUE="${ADMIN_HTTP_PORT:-$(compose_env_value ADMIN_HTTP_PORT)}"
WEB_BASE_URL_VALUE="${WEB_BASE_URL:-$(compose_env_value WEB_BASE_URL)}"
RUN_SERVER_SECURITY_CHECK_VALUE="${RUN_SERVER_SECURITY_CHECK:-$(compose_env_value RUN_SERVER_SECURITY_CHECK)}"
INSTALL_MAINTENANCE_CRON_VALUE="${INSTALL_MAINTENANCE_CRON:-$(compose_env_value INSTALL_MAINTENANCE_CRON)}"
MYSQL_PASSWORD_VALUE="${MYSQL_PASSWORD:-$(compose_env_value MYSQL_PASSWORD)}"
MYSQL_ROOT_PASSWORD_VALUE="${MYSQL_ROOT_PASSWORD:-$(compose_env_value MYSQL_ROOT_PASSWORD)}"
JWT_SECRET_VALUE="${JWT_SECRET:-$(compose_env_value JWT_SECRET)}"
INITIAL_ADMIN_PASSWORD_VALUE="${INITIAL_ADMIN_PASSWORD:-$(compose_env_value INITIAL_ADMIN_PASSWORD)}"

if [[ ! "$MYSQL_PASSWORD_VALUE" =~ ^[A-Za-z0-9._~-]{24,}$ ]] || \
   [[ ! "$MYSQL_ROOT_PASSWORD_VALUE" =~ ^[A-Za-z0-9._~-]{24,}$ ]]; then
  echo "部署已拒绝：MySQL 密码必须至少 24 位，并仅使用 URL 安全字符"
  exit 1
fi
if [ "${#JWT_SECRET_VALUE}" -lt 32 ] || [[ "$JWT_SECRET_VALUE" =~ please-change|dev-secret|coffee-os ]]; then
  echo "部署已拒绝：JWT_SECRET 必须是至少 32 位的随机强密钥"
  exit 1
fi
if ! [[ "${HTTP_PORT_VALUE:-8080}" =~ ^[0-9]+$ ]] || \
   [ "${HTTP_PORT_VALUE:-8080}" -lt 1024 ] || [ "${HTTP_PORT_VALUE:-8080}" -gt 65535 ]; then
  echo "部署已拒绝：HTTP_PORT 必须是 1024–65535 的端口"
  exit 1
fi
if ! [[ "${ADMIN_HTTP_PORT_VALUE:-8081}" =~ ^[0-9]+$ ]] || \
   [ "${ADMIN_HTTP_PORT_VALUE:-8081}" -lt 1024 ] || [ "${ADMIN_HTTP_PORT_VALUE:-8081}" -gt 65535 ] || \
   [ "${ADMIN_HTTP_PORT_VALUE:-8081}" = "${HTTP_PORT_VALUE:-8080}" ]; then
  echo "部署已拒绝：ADMIN_HTTP_PORT 必须是未与 HTTP_PORT 重复的 1024–65535 端口"
  exit 1
fi

CURRENT_STAGE="Compose 配置校验"
docker compose config --quiet

AVAILABLE_KB="$(df -Pk . | awk 'NR==2 { print $4 }')"
if ! [[ "$AVAILABLE_KB" =~ ^[0-9]+$ ]] || [ "$AVAILABLE_KB" -lt 5242880 ]; then
  echo "部署已拒绝：当前磁盘可用空间不足 5GB"
  exit 1
fi

echo "=========================================="
echo " Coffee OS 部署（方案B：内网端口 + 网关转发）"
echo "=========================================="

if docker compose ps --status running --services 2>/dev/null | grep -qx server && \
   docker compose ps --status running --services 2>/dev/null | grep -qx mysql; then
  CURRENT_STAGE="部署前自动备份"
  echo "[preflight] 检测到运行中的旧版本，先备份数据库和上传文件"
  bash deploy/backup.sh
fi

echo "[1/6] 构建镜像并启动 MySQL"
CURRENT_STAGE="镜像构建"
if [ "$SKIP_BUILD" = false ]; then
  docker compose build --pull
fi
CURRENT_STAGE="MySQL 启动"
docker compose up -d mysql

echo "[2/6] 等待 MySQL 健康"
CURRENT_STAGE="MySQL 健康检查"
MYSQL_HEALTHY=false
for _ in $(seq 1 60); do
  MYSQL_STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' coffee-mysql 2>/dev/null || true)"
  if [ "$MYSQL_STATUS" = "healthy" ]; then
    MYSQL_HEALTHY=true
    break
  fi
  if [ "$MYSQL_STATUS" = "unhealthy" ] || [ "$MYSQL_STATUS" = "exited" ] || [ "$MYSQL_STATUS" = "dead" ]; then
    break
  fi
  sleep 2
done
if [ "$MYSQL_HEALTHY" != true ]; then
  echo "MySQL 在 120 秒内未达到健康状态"
  exit 1
fi

if [ "${BASELINE_EXISTING_DB_VALUE:-false}" = "true" ]; then
  echo "[3/6] 将旧版已建表数据库登记为迁移基线"
  CURRENT_STAGE="旧数据库迁移基线登记"
  docker compose run --rm server npx prisma migrate resolve --applied 20260826000100_init
  bash deploy/update-env.sh BASELINE_EXISTING_DB false
else
  echo "[3/6] 使用版本化迁移初始化/升级数据库"
fi

echo "[4/6] 启动 API 与内部管理后台"
CURRENT_STAGE="应用容器启动与数据库迁移"
docker compose up -d

echo "[5/6] 等待服务与数据库就绪"
CURRENT_STAGE="应用健康检查"
WEB_HEALTHY=false
ADMIN_WEB_HEALTHY=false
for _ in $(seq 1 90); do
  WEB_STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' coffee-web 2>/dev/null || true)"
  ADMIN_WEB_STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' coffee-admin-web 2>/dev/null || true)"
  SERVER_STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' coffee-server 2>/dev/null || true)"
  if [ "$WEB_STATUS" = "healthy" ] && [ "$ADMIN_WEB_STATUS" = "healthy" ]; then
    WEB_HEALTHY=true
    ADMIN_WEB_HEALTHY=true
    break
  fi
  if [ "$WEB_STATUS" = "unhealthy" ] || [ "$WEB_STATUS" = "exited" ] || \
     [ "$ADMIN_WEB_STATUS" = "unhealthy" ] || [ "$ADMIN_WEB_STATUS" = "exited" ] || \
     [ "$SERVER_STATUS" = "unhealthy" ] || [ "$SERVER_STATUS" = "exited" ]; then
    break
  fi
  sleep 2
done
if [ "$WEB_HEALTHY" != true ] || [ "$ADMIN_WEB_HEALTHY" != true ]; then
  echo "应用在 180 秒内未达到健康状态"
  exit 1
fi

if [ "${INITIALIZE_SEED_VALUE:-false}" = "true" ]; then
  CURRENT_STAGE="初始化基础数据"
  echo "[seed] 首次写入基础数据"
  if [ -n "$INITIAL_ADMIN_PASSWORD_VALUE" ]; then
    umask 077
    mkdir -p var
    {
      echo "username=admin"
      echo "password=$INITIAL_ADMIN_PASSWORD_VALUE"
    } > var/initial-admin-credentials.txt
    chmod 600 var/initial-admin-credentials.txt
  fi
  docker compose exec -T server node dist-seed/seed.js
  bash deploy/update-env.sh INITIALIZE_SEED false
  bash deploy/update-env.sh INITIAL_ADMIN_PASSWORD ""
fi

echo "[6/6] 验证 API（本机内网）"
CURRENT_STAGE="本机 readiness 验证"
PORT="${HTTP_PORT_VALUE:-8080}"
ADMIN_PORT="${ADMIN_HTTP_PORT_VALUE:-8081}"
curl -fsS "http://127.0.0.1:${PORT}/api/health/ready" >/dev/null
curl -fsS "http://127.0.0.1:${ADMIN_PORT}/api/health/ready" >/dev/null

if [ "${INSTALL_MAINTENANCE_CRON_VALUE:-true}" = "true" ]; then
  CURRENT_STAGE="备份与监控任务安装"
  if ! command -v crontab >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      SUDO=""
      if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
      $SUDO apt-get update
      $SUDO apt-get install -y cron
      $SUDO systemctl enable --now cron 2>/dev/null || true
    else
      echo "未检测到 crontab，请安装 cron 或设置 INSTALL_MAINTENANCE_CRON=false"
      exit 1
    fi
  fi
  bash deploy/backup.sh
  bash deploy/install-backup.sh
  bash deploy/install-monitor.sh
fi

if [ "$WITH_HTTPS" = true ]; then
  CURRENT_STAGE="HTTPS 网关配置"
  bash deploy/setup-https.sh
fi

if [ "${RUN_SERVER_SECURITY_CHECK_VALUE:-false}" = "true" ]; then
  bash deploy/security-check.sh
fi

echo ""
echo "部署完成！"
echo "  本机内网入口: http://127.0.0.1:${PORT}"
echo "  电脑管理端:   http://127.0.0.1:${ADMIN_PORT}（仅服务器本机；待管理域名 HTTPS 网关启用）"
echo "  对外访问:     由宿主机 Nginx 网关按域名转发"
echo "  商家后台:     ${WEB_BASE_URL_VALUE%/}/#/pages_admin/login/index（首次登录后立即修改初始密码）"
if [ -f var/initial-admin-credentials.txt ]; then
  echo "  初始管理员凭据保存在服务器受限文件：var/initial-admin-credentials.txt"
fi
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f server"
echo "  重启:     docker compose restart"
echo "  更新:     git pull && docker compose up -d --build"
echo "  一键更新: git pull && ./deploy.sh"
echo "  停止:     docker compose down"
