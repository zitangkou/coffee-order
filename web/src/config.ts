// 后端 API 地址：H5 开发默认本地；生产环境通过 VITE_API_BASE 注入。
// 注意：
// 1. 必须用 import.meta.env 静态写法，Vite 构建时才会替换变量；
//    不能用 (import.meta as any)?.env?.xxx 动态访问，否则退化为 localhost 兜底，
//    导致手机端请求打到手机自己（request:fail）。
// 2. uni-app H5 的 request 在部分手机浏览器不支持相对路径，故 H5 平台补全为绝对地址。
export const API_BASE: string = (() => {
  // #ifdef MP-WEIXIN
  const mpBase: string = import.meta.env.VITE_MP_API_BASE || "";
  if (mpBase) return mpBase.replace(/\/$/, "");
  // #endif
  const base: string = import.meta.env.VITE_API_BASE || "/api";
  // #ifdef H5
  // 兜底：任何情况都不允许请求打到 localhost（手机上等于请求手机自己）
  if (base.startsWith("/") || base.includes("localhost") || base.includes("127.0.0.1")) {
    return window.location.origin + "/api";
  }
  // #endif
  return base;
})();

export const ASSET_BASE: string = (() => {
  const configured: string = import.meta.env.VITE_ASSET_BASE || "";
  if (configured) return configured.replace(/\/$/, "");
  if (/^https?:\/\//.test(API_BASE)) return API_BASE.replace(/\/api\/?$/, "");
  return "";
})();

export const STORAGE_KEYS = {
  userToken: "user_token",
  userId: "user_id",
  deviceId: "device_id",
  adminToken: "admin_token",
  adminInfo: "admin_info",
};

// 当前发布目标仅为微信小程序；H5 默认仅承载商家后台。
export const H5_CUSTOMER_ENABLED: boolean =
  import.meta.env.VITE_H5_CUSTOMER_ENABLED === "true";

// 微信订阅消息模板通过私密构建环境注入，不提交到仓库；未配置时跳过订阅引导。
export const WX_SUBSCRIBE_TEMPLATE_READY: string =
  import.meta.env.VITE_WX_SUBSCRIBE_TEMPLATE_READY || "";

// 以下均为会公开展示在小程序内的经营者信息，不应放置任何密钥或证书内容。
export const LEGAL_OPERATOR_NAME: string =
  import.meta.env.VITE_LEGAL_OPERATOR_NAME || "待经营者确认";
export const LEGAL_CUSTOMER_SERVICE: string =
  import.meta.env.VITE_LEGAL_CUSTOMER_SERVICE || "待经营者确认";
export const LEGAL_STORE_ADDRESS: string =
  import.meta.env.VITE_LEGAL_STORE_ADDRESS || "待经营者确认";
export const LEGAL_DATA_RETENTION: string =
  import.meta.env.VITE_LEGAL_DATA_RETENTION || "待经营者确认";
