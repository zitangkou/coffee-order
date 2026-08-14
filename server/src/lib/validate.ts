export function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function str(v: unknown, def = ""): string {
  return typeof v === "string" ? v : def;
}
