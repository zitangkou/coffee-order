#!/usr/bin/env bash
# 为独立电脑管理端安装宿主机 Nginx HTTPS 网关。
set -euo pipefail
cd "$(dirname "$0")/.."

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

compose_env_value() {
  docker compose config --environment | awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

PUBLIC_URL="${ADMIN_BASE_URL:-$(compose_env_value ADMIN_BASE_URL)}"
PUBLIC_URL="${PUBLIC_URL:-https://admin.nagacoffee.site}"
EMAIL="${LETSENCRYPT_EMAIL:-$(compose_env_value LETSENCRYPT_EMAIL)}"
WITHOUT_EMAIL="${LETSENCRYPT_WITHOUT_EMAIL:-$(compose_env_value LETSENCRYPT_WITHOUT_EMAIL)}"
ADMIN_PORT="${ADMIN_HTTP_PORT:-$(compose_env_value ADMIN_HTTP_PORT)}"
DOMAIN="${PUBLIC_URL#*://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN%%:*}"

if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || [[ "$DOMAIN" != *.* ]]; then
  echo "[admin-https] ADMIN_BASE_URL 中的域名无效"
  exit 1
fi
if ! [[ "${ADMIN_PORT:-8081}" =~ ^[0-9]+$ ]]; then
  echo "[admin-https] ADMIN_HTTP_PORT 无效"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO apt-get install -y nginx certbot
fi

SITE_FILE="/etc/nginx/sites-available/coffee-admin-${DOMAIN}.conf"
SITE_LINK="/etc/nginx/sites-enabled/coffee-admin-${DOMAIN}.conf"
ACME_ROOT="/var/www/letsencrypt"
$SUDO mkdir -p "$ACME_ROOT"

restore_http() {
  $SUDO cp "$bootstrap_file" "$SITE_FILE"
  $SUDO nginx -t
  $SUDO systemctl reload nginx
  for _ in {1..10}; do
    if curl -fsS -H "Host: $DOMAIN" --connect-timeout 2 --max-time 5 \
      "http://127.0.0.1/api/health/ready" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "[admin-https] HTTP 回退后的 readiness 校验失败，请立即检查 Nginx"
  return 1
}

bootstrap_file="$(mktemp)"
final_file="$(mktemp)"
trap 'rm -f "$bootstrap_file" "$final_file"' EXIT
sed -e "s/__ADMIN_DOMAIN__/$DOMAIN/g" -e "s/__ADMIN_HTTP_PORT__/${ADMIN_PORT:-8081}/g" \
  deploy/nginx.admin.bootstrap.conf > "$bootstrap_file"
$SUDO cp "$bootstrap_file" "$SITE_FILE"
$SUDO ln -sfn "$SITE_FILE" "$SITE_LINK"
$SUDO nginx -t
$SUDO systemctl reload nginx

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ ! -s "$CERT_DIR/fullchain.pem" ] || [ ! -s "$CERT_DIR/privkey.pem" ]; then
  if [[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    $SUDO certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
      --non-interactive --agree-tos --email "$EMAIL" --keep-until-expiring
  elif [ "${WITHOUT_EMAIL:-false}" = "true" ]; then
    echo "[admin-https] 未配置通知邮箱，使用无邮箱模式签发；请上线后补登记邮箱"
    $SUDO certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
      --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
  else
    echo "[admin-https] 请填写 LETSENCRYPT_EMAIL，或显式设置 LETSENCRYPT_WITHOUT_EMAIL=true"
    exit 1
  fi
fi

sed -e "s/__ADMIN_DOMAIN__/$DOMAIN/g" -e "s/__ADMIN_HTTP_PORT__/${ADMIN_PORT:-8081}/g" \
  deploy/nginx.admin.conf > "$final_file"
$SUDO cp "$final_file" "$SITE_FILE"
$SUDO nginx -t
$SUDO systemctl reload nginx
$SUDO systemctl enable --now certbot.timer 2>/dev/null || true

if ! curl -fsS --resolve "$DOMAIN:443:127.0.0.1" --connect-timeout 5 --max-time 15 \
  "https://$DOMAIN/api/health/ready" >/dev/null; then
  echo "[admin-https] 本机 HTTPS 校验失败，正在恢复 HTTP 配置"
  restore_http || true
  exit 1
fi

if ! curl -fsS --connect-timeout 10 --max-time 20 "https://$DOMAIN/api/health/ready" >/dev/null; then
  echo "[admin-https] 公网 HTTPS 尚不可达，可能是 DNS 或云安全组未生效；已恢复 HTTP 入口"
  restore_http || true
  exit 1
fi
echo "[admin-https] 独立电脑管理端 HTTPS 配置完成"
