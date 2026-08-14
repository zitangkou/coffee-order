import type { Product } from "@prisma/client";
import { parseJson } from "../lib/json.js";

export type SpecValue = string | string[];

export function calcUnitPrice(
  product: Product,
  specs: Record<string, SpecValue> = {}
): number {
  let total = Number(product.price);
  const specDefs = parseJson<Record<
    string,
    { label: string; extra: number }[]
  >>(product.specsJson, {});
  for (const [key, value] of Object.entries(specs)) {
    const defs = specDefs[key] ?? [];
    const selected = Array.isArray(value) ? value : [value];
    for (const s of selected) {
      const def = defs.find((d) => d.label === s);
      if (def) total += Number(def.extra ?? 0);
    }
  }
  return Math.round(total * 100) / 100;
}
