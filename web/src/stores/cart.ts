import { defineStore } from "pinia";

export interface CartItem {
  key: string;
  productId: number;
  name: string;
  image?: string;
  specs: Record<string, string | string[]>;
  unitPrice: number;
  quantity: number;
}

function itemKey(productId: number, specs: Record<string, string | string[]>) {
  return `${productId}-${JSON.stringify(specs)}`;
}

export const useCartStore = defineStore("cart", {
  state: () => ({
    items: [] as CartItem[],
    remark: "",
  }),
  getters: {
    count: (state) => state.items.reduce((s, i) => s + i.quantity, 0),
    total: (state) =>
      Math.round(state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100,
  },
  actions: {
    add(item: Omit<CartItem, "key">) {
      const key = itemKey(item.productId, item.specs);
      const found = this.items.find((i) => i.key === key);
      if (found) {
        found.quantity += item.quantity;
      } else {
        this.items.push({ ...item, key });
      }
    },
    remove(key: string) {
      this.items = this.items.filter((i) => i.key !== key);
    },
    setQuantity(key: string, quantity: number) {
      const item = this.items.find((i) => i.key === key);
      if (!item) return;
      item.quantity = Math.max(1, Math.min(99, quantity));
    },
    clear() {
      this.items = [];
      this.remark = "";
    },
  },
});
