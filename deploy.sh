#!/usr/bin/env bash
# Coffee OS 一键 Docker 部署脚本（在云服务器上执行）
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo " Coffee OS 一键部署"
echo "=========================================="

# 可选：腾讯云 Docker Hub 加速（拉取镜像慢时设置 DOCKER_MIRROR=mirror.ccs.tencentyun.com）
if [ -n "$DOCKER_MIRROR" ]; then
  echo "[1/4] 配置 Docker 镜像加速: $DOCKER_MIRROR"
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": ["https://$DOCKER_MIRROR"]
}
EOF
  systemctl restart docker || service docker restart || true
fi

echo "[2/4] 构建并启动容器（MySQL + 后端 + 前端）"
docker compose up -d --build

echo "[3/4] 等待服务健康检查通过..."
for i in $(seq 1 30); do
  if docker inspect --format '{{.State.Health.Status}}' coffee-web 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

echo "[4/4] 验证 API"
PORT="${HTTP_PORT:-80}"
curl -fsS "http://localhost:${PORT}/api/health" && echo

echo ""
echo "部署完成！"
echo "  顾客端首页:  http://<服务器IP或域名>:${PORT}/#/pages/index/index"
echo "  商家后台:    http://<服务器IP或域名>:${PORT}/#/pages_admin/login/index"
echo "  默认账号:    admin / admin123（上线前请修改）"
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f server"
echo "  重启:     docker compose restart"
echo "  更新:     git pull && docker compose up -d --build"
