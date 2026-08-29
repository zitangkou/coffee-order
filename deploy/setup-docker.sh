#!/usr/bin/env bash
# Docker 环境初始化（只执行一次）：安装 Docker/Compose + 配置多源镜像加速
# 多项目共存时，全局环境只初始化一次，之后每个项目仅执行自己的 ./deploy.sh
set -euo pipefail

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "=========================================="
echo " Docker 环境初始化（一次性）"
echo "=========================================="

if ! command -v docker >/dev/null 2>&1; then
  echo "[1/3] 安装 Docker（官方脚本，失败回退 apt）..."
  curl -fsSL https://get.docker.com | $SUDO sh || {
    $SUDO apt-get update
    $SUDO apt-get install -y docker.io
  }
  $SUDO systemctl enable --now docker || true
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[2/3] 安装 Docker Compose v2..."
  $SUDO apt-get install -y docker-compose-plugin 2>/dev/null || {
    $SUDO mkdir -p /usr/local/lib/docker/cli-plugins
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64) COMPOSE_ARCH=x86_64 ;;
      aarch64|arm64) COMPOSE_ARCH=aarch64 ;;
      *) echo "不支持的 CPU 架构：$ARCH"; exit 1 ;;
    esac
    $SUDO curl -fsSL \
      "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    $SUDO chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  }
fi

echo "[3/3] 配置 Docker 镜像加速（多源，含腾讯云内网加速）"
MIRRORS='["https://mirror.ccs.tencentyun.com", "https://docker.m.daocloud.io"]'
if [ -n "${DOCKER_MIRROR:-}" ]; then
  MIRRORS="[\"https://$DOCKER_MIRROR\"]"
fi
$SUDO mkdir -p /etc/docker
TEMP_DAEMON="$(mktemp)"
trap 'rm -f "$TEMP_DAEMON"' EXIT
if command -v python3 >/dev/null 2>&1; then
  $SUDO python3 - "$MIRRORS" > "$TEMP_DAEMON" <<'PY'
import json, os, sys
path = "/etc/docker/daemon.json"
try:
    with open(path, "r", encoding="utf-8") as file:
        config = json.load(file)
except (FileNotFoundError, json.JSONDecodeError):
    config = {}
config["registry-mirrors"] = json.loads(sys.argv[1])
json.dump(config, sys.stdout, ensure_ascii=False, indent=2)
sys.stdout.write("\n")
PY
else
  printf '{\n  "registry-mirrors": %s\n}\n' "$MIRRORS" > "$TEMP_DAEMON"
fi
$SUDO cp "$TEMP_DAEMON" /etc/docker/daemon.json
$SUDO systemctl daemon-reload
$SUDO systemctl restart docker || $SUDO service docker restart || true

if [ "$(id -u)" -ne 0 ] && ! id -nG | tr ' ' '\n' | grep -qx docker; then
  $SUDO usermod -aG docker "$(id -un)"
  echo "当前用户已加入 docker 组；请重新登录服务器后执行 ./deploy.sh"
fi

echo ""
echo "Docker 初始化完成。继续执行：./deploy.sh"
