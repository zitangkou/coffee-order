#!/usr/bin/env bash
# Coffee Order 部署脚本（只构建/启动本项目，不做全局环境配置）
# 首次使用前先执行一次 deploy/setup-docker.sh
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 Docker / Docker Compose，请先执行：bash deploy/setup-docker.sh"
  exit 1
fi

echo "=========================================="
echo " Coffee OS 部署（方案B：内网端口 + 网关转发）"
echo "=========================================="

echo "[1/3] 构建并启动容器（MySQL + 后端 + 前端）"
docker compose up -d --build

echo "[2/3] 等待服务健康检查通过..."
for i in $(seq 1 40); do
  if docker inspect --format '{{.State.Health.Status}}' coffee-web 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

echo "[3/3] 验证 API（本机内网）"
PORT="${HTTP_PORT:-8080}"
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
