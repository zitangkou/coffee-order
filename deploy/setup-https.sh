#!/usr/bin/env bash
# 为当前域名安装宿主机 Nginx HTTPS 网关；不会读取或输出微信/支付配置。
set -euo pipefail
cd "$(dirname "$0")/.."

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

PUBLIC_URL="${WEB_BASE_URL:-$(compose_env_value WEB_BASE_URL)}"
EMAIL="${LETSENCRYPT_EMAIL:-$(compose_env_value LETSENCRYPT_EMAIL)}"
HTTP_PORT_VALUE="${HTTP_PORT:-$(compose_env_value HTTP_PORT)}"
DOMAIN="${PUBLIC_URL#*://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN%%:*}"

if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || [[ "$DOMAIN" != *.* ]]; then
  echo "[https] WEB_BASE_URL 中的域名无效"
  exit 1
fi
if [[ ! "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "[https] 请先在 .env 填写 LETSENCRYPT_EMAIL"
  exit 1
fi
if ! [[ "${HTTP_PORT_VALUE:-8080}" =~ ^[0-9]+$ ]]; then
  echo "[https] HTTP_PORT 无效"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO apt-get install -y nginx certbot
fi

SITE_FILE="/etc/nginx/sites-available/coffee-${DOMAIN}.conf"
SITE_LINK="/etc/nginx/sites-enabled/coffee-${DOMAIN}.conf"
ACME_ROOT="/var/www/letsencrypt"
$SUDO mkdir -p "$ACME_ROOT"

BOOTSTRAP_FILE="$(mktemp)"
trap 'rm -f "$BOOTSTRAP_FILE"' EXIT
sed \
  -e "s/__DOMAIN__/$DOMAIN/g" \
  -e "s/__HTTP_PORT__/${HTTP_PORT_VALUE:-8080}/g" \
  deploy/nginx.bootstrap.conf > "$BOOTSTRAP_FILE"
$SUDO cp "$BOOTSTRAP_FILE" "$SITE_FILE"
$SUDO ln -sfn "$SITE_FILE" "$SITE_LINK"
$SUDO nginx -t
$SUDO systemctl enable --now nginx
$SUDO systemctl reload nginx

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ ! -s "$CERT_DIR/fullchain.pem" ] || [ ! -s "$CERT_DIR/privkey.pem" ]; then
  $SUDO certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos --email "$EMAIL" --keep-until-expiring
fi

sed \
  -e "s/nagacoffee\.site/$DOMAIN/g" \
  -e "s/127\.0\.0\.1:8080/127.0.0.1:${HTTP_PORT_VALUE:-8080}/g" \
  deploy/nginx.conf > "$BOOTSTRAP_FILE"
$SUDO cp "$BOOTSTRAP_FILE" "$SITE_FILE"
$SUDO nginx -t
$SUDO systemctl reload nginx
$SUDO systemctl enable --now certbot.timer 2>/dev/null || true

curl -fsS --connect-timeout 10 --max-time 20 "https://$DOMAIN/api/health/ready" >/dev/null

echo "[https] HTTPS 网关配置完成，并已通过 Nginx 配置检查"
