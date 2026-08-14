// 后端 API 地址：H5 开发默认本地；生产环境通过 VITE_API_BASE 注入
export const API_BASE: string =
  (import.meta as any)?.env?.VITE_API_BASE || "http://localhost:3000/api";

export const STORAGE_KEYS = {
  userToken: "user_token",
  userId: "user_id",
  deviceId: "device_id",
  adminToken: "admin_token",
  adminInfo: "admin_info",
};
