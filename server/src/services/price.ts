export type SpecValue = string | string[];

export interface SpecOptionLite {
  label: string;
  extraPrice: number;
}

export interface SpecGroupLite {
  name: string;
  type: string;
  required: boolean;
  options: SpecOptionLite[];
}

/**
 * 根据商品关联的规格组（DB 结构化数据）计算单价。
 * specs 的 key 为规格组名，值为选项 label（多选为数组）。
 */
export function calcUnitPrice(
  product: { price: number; specGroups: SpecGroupLite[] },
  specs: Record<string, SpecValue> = {}
): number {
  let total = Number(product.price);
  for (const group of product.specGroups ?? []) {
    const selected = specs[group.name];
    if (selected == null) continue;
    const values = Array.isArray(selected) ? selected : [selected];
    for (const v of values) {
      const opt = (group.options ?? []).find((o) => o.label === v);
      if (opt) total += Number(opt.extraPrice || 0);
    }
  }
  return Math.round(total * 100) / 100;
}
