import { defineStore } from "pinia";
import type { AdminInfo } from "../types";

function readInfo(): AdminInfo | null {
  try {
    return JSON.parse(localStorage.getItem("admin_info") || "null");
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem("admin_token") || "",
    admin: readInfo() as AdminInfo | null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token && state.admin),
    isManager: (state) => state.admin?.role === "MANAGER",
  },
  actions: {
    setSession(token: string, admin: AdminInfo) {
      this.token = token;
      this.admin = admin;
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_info", JSON.stringify(admin));
    },
    updatePasswordSession(token: string) {
      if (!this.admin) return;
      this.setSession(token, { ...this.admin, mustChangePassword: false });
    },
    clear() {
      this.token = "";
      this.admin = null;
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_info");
    },
  },
});
