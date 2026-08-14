#!/usr/bin/env bash
# Coffee OS 一键部署脚本（Ubuntu 22.04 云服务器，root 或 sudo 用户执行）
set -e
cd "$(dirname "$0")"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "=========================================="
echo " Coffee OS 一键部署"
echo "=========================================="

echo "[1/6] 检查/安装 Docker 与 Docker Compose"
if ! command -v docker >/dev/null 2>&1; then
  echo "  未检测到 Docker，开始安装（官方脚本，失败则回退 apt）..."
  curl -fsSL https://get.docker.com | sh || $SUDO apt-get install -y docker.io
  $SUDO systemctl enable --now docker || true
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "  未检测到 Docker Compose v2，尝试安装..."
  $SUDO apt-get install -y docker-compose-plugin 2>/dev/null || {
    $SUDO mkdir -p /usr/local/lib/docker/cli-plugins
    $SUDO curl -SL \
      https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    $SUDO chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  }
fi

echo "[2/6] 配置 Docker 镜像加速（腾讯云）"
if [ -n "$DOCKER_MIRROR" ]; then
  MIRROR_URL="https://$DOCKER_MIRROR"
else
  MIRROR_URL="https://mirror.ccs.tencentyun.com"
fi
$SUDO mkdir -p /etc/docker
cat <<EOF | $SUDO tee /etc/docker/daemon.json >/dev/null
{
  "registry-mirrors": ["$MIRROR_URL"]
}
EOF
$SUDO systemctl restart docker || $SUDO service docker restart || true

echo "[3/6] 构建并启动容器（MySQL + 后端 + 前端）"
docker compose up -d --build

echo "[4/6] 等待服务健康检查通过..."
for i in $(seq 1 40); do
  if docker inspect --format '{{.State.Health.Status}}' coffee-web 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

echo "[5/6] 验证 API"
PORT="${HTTP_PORT:-80}"
curl -fsS "http://localhost:${PORT}/api/health" && echo

echo "[6/6] 完成"
echo ""
echo "部署完成！"
echo "  顾客端首页:  http://<服务器IP或域名>:${PORT}/#/pages/index/index"
echo "  商家后台:    http://<服务器IP或域名>:${PORT}/#/pages_admin/login/index"
echo "  默认账号:    admin / admin123（上线前请修改）"
echo ""
echo "常用命令："
echo "  查看日志:   docker compose logs -f server"
echo "  重启:       docker compose restart"
echo "  更新:       git pull && docker compose up -d --build"
echo "  停止:       docker compose down"
