// 短信验证码发送：默认 console 模式（开发/试用直接打印验证码），生产接入短信服务商
export function isConsoleSms(): boolean {
  return (process.env.SMS_PROVIDER || "console") === "console";
}

export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER || "console";
  if (provider === "console") {
    console.log(`[sms] 验证码 ${code} 发送至 ${phone}`);
    return;
  }
  // TODO: 接入阿里云/腾讯云短信（配置 SMS_PROVIDER=aliyun/tencent + AccessKey）
  throw new Error("短信服务未配置，请先接入短信服务商");
}
