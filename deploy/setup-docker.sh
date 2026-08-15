#!/usr/bin/env bash
# Docker 环境初始化（只执行一次）：安装 Docker/Compose + 配置多源镜像加速
# 多项目共存时，全局环境只初始化一次，之后每个项目仅执行自己的 ./deploy.sh
set -e

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "=========================================="
echo " Docker 环境初始化（一次性）"
echo "=========================================="

if ! command -v docker >/dev/null 2>&1; then
  echo "[1/3] 安装 Docker（官方脚本，失败回退 apt）..."
  curl -fsSL https://get.docker.com | sh || $SUDO apt-get install -y docker.io
  $SUDO systemctl enable --now docker || true
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[2/3] 安装 Docker Compose v2..."
  $SUDO apt-get install -y docker-compose-plugin 2>/dev/null || {
    $SUDO mkdir -p /usr/local/lib/docker/cli-plugins
    $SUDO curl -SL \
      https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    $SUDO chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  }
fi

echo "[3/3] 配置 Docker 镜像加速（多源，含腾讯云内网加速）"
MIRRORS='["https://mirror.ccs.tencentyun.com", "https://mirror.baidubce.com", "https://docker.1panel.live", "https://docker.m.daocloud.io"]'
if [ -n "$DOCKER_MIRROR" ]; then
  MIRRORS="[\"https://$DOCKER_MIRROR\"]"
fi
$SUDO mkdir -p /etc/docker
cat <<EOF | $SUDO tee /etc/docker/daemon.json >/dev/null
{
  "registry-mirrors": $MIRRORS
}
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl restart docker || $SUDO service docker restart || true

echo ""
echo "Docker 初始化完成。之后每个项目只需：docker compose up -d --build"
