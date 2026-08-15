export function parseJson<T>(value: unknown, def: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return def;
    }
  }
  return (value as T) ?? def;
}

export function stringifyJson(value: unknown): string {
  if (value === undefined || value === null) return "{}";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export function serializeProduct(product: any) {
  if (!product) return product;
  const { specGroups, ...rest } = product;
  return {
    ...rest,
    specGroups: (specGroups ?? []).map((psg: any) => ({
      id: psg.specGroup.id,
      name: psg.specGroup.name,
      type: psg.specGroup.type,
      required: psg.required,
      sortOrder: psg.sortOrder,
      options: (psg.specGroup.options ?? []).map((o: any) => ({
        id: o.id,
        label: o.label,
        extraPrice: Number(o.extraPrice ?? 0),
        isDefault: o.isDefault,
        sortOrder: o.sortOrder,
      })),
    })),
  };
}

export function serializeOrder(order: any) {
  if (!order) return order;
  return {
    ...order,
    items:
      order.items?.map((i: any) => ({
        ...i,
        specsDetail: parseJson(i.specsDetail, {}),
      })) ?? order.items,
  };
}
