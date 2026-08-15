// 平台适配：仅微信小程序端生效（条件编译），H5 端全部为 false/空实现

let isMpWeixin = false;
// #ifdef MP-WEIXIN
isMpWeixin = true;
// #endif

export const IS_MP_WEIXIN = isMpWeixin;

// 微信登录：uni.login 换取 code
export function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    uni.login({
      provider: "weixin",
      success: (res) => resolve(res.code),
      fail: (err) => reject(new Error(err.errMsg || "微信登录失败")),
    });
    // #endif
    // #ifndef MP-WEIXIN
    reject(new Error("仅微信小程序支持微信登录"));
    // #endif
  });
}

// 微信支付：拉起收银台，返回是否支付成功
export function requestPayment(params: Record<string, string>): Promise<boolean> {
  return new Promise((resolve) => {
    // #ifdef MP-WEIXIN
    uni.requestPayment({
      provider: "weixin",
      ...params,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
    // #endif
    // #ifndef MP-WEIXIN
    resolve(false);
    // #endif
  });
}

// 订阅消息：请求用户授权，返回是否同意
export function subscribeMessage(templateId: string): Promise<boolean> {
  return new Promise((resolve) => {
    // #ifdef MP-WEIXIN
    uni.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => resolve((res as any)[templateId] === "accept"),
      fail: () => resolve(false),
    });
    // #endif
    // #ifndef MP-WEIXIN
    resolve(false);
    // #endif
  });
}
