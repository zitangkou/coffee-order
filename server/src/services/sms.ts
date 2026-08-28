// 短信验证码发送：默认 console 模式（开发/试用直接打印验证码），生产接入短信服务商
export function isConsoleSms(): boolean {
  return (process.env.SMS_PROVIDER || (process.env.NODE_ENV === "production" ? "disabled" : "console")) === "console";
}

export function isSmsEnabled(): boolean {
  return (process.env.SMS_PROVIDER || (process.env.NODE_ENV === "production" ? "disabled" : "console")) !== "disabled";
}

export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER || (process.env.NODE_ENV === "production" ? "disabled" : "console");
  if (provider === "console") {
    console.log(`[sms] 验证码 ${code} 发送至 ${phone}`);
    return;
  }
  if (provider === "disabled") throw new Error("手机号绑定服务暂未开放");
  // TODO: 接入阿里云/腾讯云短信（配置 SMS_PROVIDER=aliyun/tencent + AccessKey）
  throw new Error("短信服务未配置，请先接入短信服务商");
}
