import { ASSET_BASE } from "../config";

export function assetUrl(value?: string | null): string {
  if (!value) return "";
  if (/^(https?:|data:|wxfile:|blob:)/i.test(value)) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return ASSET_BASE ? `${ASSET_BASE}${path}` : path;
}
