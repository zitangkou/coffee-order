#!/usr/bin/env bash
set -euo pipefail

ADMIN_BASE="${ADMIN_BASE:-https://admin.nagacoffee.site}"
LEGACY_BASE="${LEGACY_BASE:-https://nagacoffee.site}"

if [[ "$ADMIN_BASE" != https://* || "$LEGACY_BASE" != https://* ]]; then
  echo "[admin-check] ✗ 正式验收地址必须使用 HTTPS"
  exit 1
fi

tmp_headers="$(mktemp)"
tmp_body="$(mktemp)"
cleanup() { rm -f "$tmp_headers" "$tmp_body"; }
trap cleanup EXIT

echo "[admin-check] 检查管理端首页与安全响应头"
curl --fail --silent --show-error --location --max-time 15 \
  --dump-header "$tmp_headers" --output "$tmp_body" "$ADMIN_BASE/"
rg -qi '<div id="app"></div>' "$tmp_body" || { echo "[admin-check] ✗ 管理端首页不是预期 SPA"; exit 1; }
for header in x-content-type-options x-frame-options content-security-policy strict-transport-security; do
  rg -qi "^${header}:" "$tmp_headers" || { echo "[admin-check] ✗ 缺少响应头 ${header}"; exit 1; }
done

echo "[admin-check] 检查 API 与 SPA 回退"
curl --fail --silent --show-error --max-time 15 "$ADMIN_BASE/api/health/ready" | rg -q '"code":0' || {
  echo "[admin-check] ✗ API readiness 异常"; exit 1;
}
curl --fail --silent --show-error --location --max-time 15 "$ADMIN_BASE/orders" | rg -q '<div id="app"></div>' || {
  echo "[admin-check] ✗ history 路由回退异常"; exit 1;
}

echo "[admin-check] 检查证书剩余有效期"
host="${ADMIN_BASE#https://}"
host="${host%%/*}"
host="${host%%:*}"
expiry="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2-)"
[[ -n "$expiry" ]] || { echo "[admin-check] ✗ 无法读取 TLS 证书"; exit 1; }
expiry_epoch="$(date -j -f '%b %e %T %Y %Z' "$expiry" +%s 2>/dev/null || date -d "$expiry" +%s 2>/dev/null || true)"
now_epoch="$(date +%s)"
[[ -n "$expiry_epoch" && $((expiry_epoch - now_epoch)) -ge 604800 ]] || {
  echo "[admin-check] ✗ TLS 证书不足 7 天或无法解析"; exit 1;
}

echo "[admin-check] 检查旧后台回退入口"
curl --fail --silent --show-error --location --max-time 15 "$LEGACY_BASE/#/pages_admin/login/index" >/dev/null

echo "[admin-check] ✓ 管理子域名、HTTPS、API、SPA 与旧后台回退检查通过"
