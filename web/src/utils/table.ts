import { api } from "../api";
import { useUserStore } from "../stores/user";

export async function applyTableId(tableId?: number | string) {
  if (!tableId) return;
  try {
    const tables = await api.getTables();
    const table = tables.find((t) => t.id === Number(tableId));
    if (table) {
      const user = useUserStore();
      user.setTable(table);
      user.setOrderType("DINE_IN");
    }
  } catch (e) {
    console.warn("applyTableId failed", e);
  }
}
