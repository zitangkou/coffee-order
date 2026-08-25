#!/usr/bin/env bash
# Coffee Order 部署脚本（只构建/启动本项目，不做全局环境配置）
# 首次使用前先执行一次 deploy/setup-docker.sh
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 Docker / Docker Compose，请先执行：bash deploy/setup-docker.sh"
  exit 1
fi

# Docker Compose 会读取 .env，但不会把值导入当前 shell；通过 Compose 自身解析，
# 避免直接 source 含特殊字符的生产密码文件。
compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}
BASELINE_EXISTING_DB_VALUE="${BASELINE_EXISTING_DB:-$(compose_env_value BASELINE_EXISTING_DB)}"
INITIALIZE_SEED_VALUE="${INITIALIZE_SEED:-$(compose_env_value INITIALIZE_SEED)}"
HTTP_PORT_VALUE="${HTTP_PORT:-$(compose_env_value HTTP_PORT)}"

echo "=========================================="
echo " Coffee OS 部署（方案B：内网端口 + 网关转发）"
echo "=========================================="

echo "[1/5] 构建镜像并启动 MySQL"
docker compose build
docker compose up -d mysql

if [ "${BASELINE_EXISTING_DB_VALUE:-false}" = "true" ]; then
  echo "[2/5] 将旧版已建表数据库登记为迁移基线"
  docker compose run --rm server npx prisma migrate resolve --applied 20260826000100_init
else
  echo "[2/5] 使用版本化迁移初始化/升级数据库"
fi

echo "[3/5] 启动 API 与内部管理后台"
docker compose up -d

echo "[4/5] 等待服务健康检查通过..."
for i in $(seq 1 40); do
  if docker inspect --format '{{.State.Health.Status}}' coffee-web 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

if [ "${INITIALIZE_SEED_VALUE:-false}" = "true" ]; then
  echo "[seed] 首次写入基础数据"
  docker compose exec -T server npm run seed
fi

echo "[5/5] 验证 API（本机内网）"
PORT="${HTTP_PORT_VALUE:-8080}"
curl -fsS "http://127.0.0.1:${PORT}/api/health" && echo

echo ""
echo "部署完成！"
echo "  本机内网入口: http://127.0.0.1:${PORT}"
echo "  对外访问:     由宿主机 Nginx 网关按域名转发（见 docs/多项目部署指南.md）"
echo "  商家后台:     http://<域名>/#/pages_admin/login/index  admin / admin123"
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f server"
echo "  重启:     docker compose restart"
echo "  更新:     git pull && docker compose up -d --build"
echo "  停止:     docker compose down"
