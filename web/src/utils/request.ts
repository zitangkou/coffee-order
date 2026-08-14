import { API_BASE, STORAGE_KEYS } from "../config";

export interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
  admin?: boolean;
}

export function request<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const header: Record<string, string> = {};
    // 仅在有请求体时设置 Content-Type；部分手机网络会拦截带 JSON 头的 GET 请求
    if (options.data !== undefined && options.method !== "GET") {
      header["Content-Type"] = "application/json";
    }
    const token = uni.getStorageSync(
      options.admin ? STORAGE_KEYS.adminToken : STORAGE_KEYS.userToken
    );
    if (token) header.Authorization = `Bearer ${token}`;

    uni.request({
      url: API_BASE + options.url,
      method: options.method || "GET",
      data: options.data as any,
      header,
      timeout: 15000,
      success: (res) => {
        const body = res.data as { code: number; data: T; msg: string };
        if (body && body.code === 0) {
          resolve(body.data);
        } else {
          reject(new Error(body?.msg || "请求失败"));
        }
      },
      fail: (err) => {
        const detail = (err as any)?.errMsg || (err as any)?.message || "网络异常";
        const full = API_BASE + options.url;
        console.error("[request fail]", options.method, full, err);
        reject(new Error(`${detail} @ ${full}`));
      },
    });
  });
}

export default request;
