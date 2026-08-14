import { defineStore } from "pinia";
import { STORAGE_KEYS } from "../config";
import { api } from "../api";
import type { Table } from "../types";

export const useUserStore = defineStore("user", {
  state: () => ({
    userId: (uni.getStorageSync(STORAGE_KEYS.userId) as number) || null,
    token: (uni.getStorageSync(STORAGE_KEYS.userToken) as string) || "",
    tableId: null as number | null,
    tableNo: "" as string,
    orderType: "DINE_IN" as "DINE_IN" | "TAKEOUT",
  }),
  actions: {
    async ensureLogin() {
      if (this.token) return;
      try {
        let deviceId = uni.getStorageSync(STORAGE_KEYS.deviceId) as string;
        if (!deviceId) {
          deviceId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          uni.setStorageSync(STORAGE_KEYS.deviceId, deviceId);
        }
        const data = await api.guestLogin(deviceId);
        this.userId = data.userId;
        this.token = data.token;
        uni.setStorageSync(STORAGE_KEYS.userId, data.userId);
        uni.setStorageSync(STORAGE_KEYS.userToken, data.token);
      } catch (e) {
        // 登录失败不阻塞浏览：游客可先看菜单，下单时再重试
        console.warn("[user] guest login failed, continue anonymous", e);
      }
    },
    setTable(table: Table | null) {
      this.tableId = table?.id ?? null;
      this.tableNo = table?.tableNo ?? "";
    },
    setOrderType(type: "DINE_IN" | "TAKEOUT") {
      this.orderType = type;
    },
  },
});
