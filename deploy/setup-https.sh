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
WITHOUT_EMAIL="${LETSENCRYPT_WITHOUT_EMAIL:-$(compose_env_value LETSENCRYPT_WITHOUT_EMAIL)}"
HTTP_PORT_VALUE="${HTTP_PORT:-$(compose_env_value HTTP_PORT)}"
DOMAIN="${PUBLIC_URL#*://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN%%:*}"

if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || [[ "$DOMAIN" != *.* ]]; then
  echo "[https] WEB_BASE_URL 中的域名无效"
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

restore_http() {
  $SUDO cp "$BOOTSTRAP_FILE" "$SITE_FILE"
  $SUDO nginx -t
  $SUDO systemctl reload nginx
  consecutive_ok=0
  for _ in {1..10}; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" \
      --connect-timeout 2 --max-time 5 "http://127.0.0.1/api/health/ready" || true)"
    if [ "$status" = "200" ]; then
      consecutive_ok=$((consecutive_ok + 1))
      if [ "$consecutive_ok" -ge 2 ]; then return 0; fi
    else
      consecutive_ok=0
    fi
    sleep 1
  done
  echo "[https] HTTP 回退后的 readiness 校验失败，请立即检查 Nginx"
  return 1
}

BOOTSTRAP_FILE="$(mktemp)"
FINAL_FILE="$(mktemp)"
trap 'rm -f "$BOOTSTRAP_FILE" "$FINAL_FILE"' EXIT
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
  if [[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    $SUDO certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
      --non-interactive --agree-tos --email "$EMAIL" --keep-until-expiring
  elif [ "${WITHOUT_EMAIL:-false}" = "true" ]; then
    echo "[https] 未配置通知邮箱，使用无邮箱模式签发；请上线后补登记邮箱"
    $SUDO certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
      --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
  else
    echo "[https] 请填写 LETSENCRYPT_EMAIL，或显式设置 LETSENCRYPT_WITHOUT_EMAIL=true"
    exit 1
  fi
fi

sed \
  -e "s/nagacoffee\.site/$DOMAIN/g" \
  -e "s/127\.0\.0\.1:8080/127.0.0.1:${HTTP_PORT_VALUE:-8080}/g" \
  deploy/nginx.conf > "$FINAL_FILE"
$SUDO cp "$FINAL_FILE" "$SITE_FILE"
$SUDO nginx -t
$SUDO systemctl reload nginx
$SUDO systemctl enable --now certbot.timer 2>/dev/null || true

if ! curl -fsS --resolve "$DOMAIN:443:127.0.0.1" --connect-timeout 5 --max-time 15 \
  "https://$DOMAIN/api/health/ready" >/dev/null; then
  echo "[https] 本机 HTTPS 校验失败，正在恢复 HTTP 配置"
  restore_http || true
  exit 1
fi

if ! curl -fsS --connect-timeout 10 --max-time 20 "https://$DOMAIN/api/health/ready" >/dev/null; then
  echo "[https] 公网 HTTPS 尚不可达，可能是云安全组未放行 443；已恢复 HTTP 入口"
  restore_http || true
  exit 1
fi

echo "[https] HTTPS 网关配置完成，并已通过 Nginx 配置检查"
