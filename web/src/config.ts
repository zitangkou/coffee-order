// 后端 API 地址：H5 开发默认本地；生产环境通过 VITE_API_BASE 注入
// 注意：uni-app H5 的 request 在部分手机浏览器（iOS Safari/微信 X5）不支持相对路径，
// 因此 H5 平台把相对路径补全为绝对地址，避免手机端 request:fail
export const API_BASE: string = (() => {
  const base: string =
    (import.meta as any)?.env?.VITE_API_BASE || "http://localhost:3000/api";
  // #ifdef H5
  if (base.startsWith("/")) {
    return window.location.origin + base;
  }
  // #endif
  return base;
})();

export const STORAGE_KEYS = {
  userToken: "user_token",
  userId: "user_id",
  deviceId: "device_id",
  adminToken: "admin_token",
  adminInfo: "admin_info",
};
