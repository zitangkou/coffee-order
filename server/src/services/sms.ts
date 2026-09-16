// 开发模式由接口响应返回 devCode；日志不记录验证码或完整手机号。
export function isConsoleSms(): boolean {
  return (process.env.SMS_PROVIDER || (process.env.NODE_ENV === "production" ? "disabled" : "console")) === "console";
}

export function isSmsEnabled(): boolean {
  return (process.env.SMS_PROVIDER || (process.env.NODE_ENV === "production" ? "disabled" : "console")) !== "disabled";
}

export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER || (process.env.NODE_ENV === "production" ? "disabled" : "console");
  if (provider === "console") {
    console.log(`[sms] 开发验证码已生成，手机号尾号 ${phone.slice(-4)}`);
    return;
  }
  if (provider === "disabled") throw new Error("手机号绑定服务暂未开放");
  // TODO: 接入阿里云/腾讯云短信（配置 SMS_PROVIDER=aliyun/tencent + AccessKey）
  throw new Error("短信服务未配置，请先接入短信服务商");
}
