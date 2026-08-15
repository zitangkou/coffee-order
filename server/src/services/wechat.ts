import crypto from "node:crypto";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";

// 微信小程序能力（登录/支付/订阅消息）骨架。
// 未配置资质时一律 fail-closed：明确报错，不影响 H5 与模拟支付。

const APPID = process.env.WECHAT_MP_APPID || "";
const SECRET = process.env.WECHAT_MP_SECRET || "";
const MCH_ID = process.env.WECHAT_MCH_ID || "";
const MCH_SERIAL = process.env.WECHAT_MCH_SERIAL || "";
const MCH_KEY_PATH = process.env.WECHAT_MCH_PRIVATE_KEY_PATH || "";
const API_V3_KEY = process.env.WECHAT_API_V3_KEY || "";
const NOTIFY_URL =
  process.env.WECHAT_PAY_NOTIFY_URL ||
  `${process.env.WEB_BASE_URL || "http://localhost"}/api/payment/callback`;
const READY_TEMPLATE_ID = process.env.WECHAT_SUBSCRIBE_TEMPLATE_READY || "";

export function wxMpConfigured(): boolean {
  return !!(APPID && SECRET);
}

export function wxPayConfigured(): boolean {
  return !!(APPID && MCH_ID && MCH_SERIAL && MCH_KEY_PATH && API_V3_KEY);
}

export function wxSubscribeConfigured(): boolean {
  return !!(wxMpConfigured() && READY_TEMPLATE_ID);
}

function nonceStr(): string {
  return crypto.randomBytes(16).toString("hex");
}

function rsaSign(message: string): string {
  const key = fs.readFileSync(MCH_KEY_PATH, "utf8");
  return crypto.createSign("RSA-SHA256").update(message).sign(key, "base64");
}

function authHeader(method: string, path: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = nonceStr();
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = rsaSign(message);
  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",` +
    `nonce_str="${nonce}",signature="${signature}",` +
    `timestamp="${timestamp}",serial_no="${MCH_SERIAL}"`
  );
}

// 微信登录：code 换取 openid
export async function jscode2session(code: string): Promise<{ openid: string; sessionKey?: string }> {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}` +
    `&secret=${SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.openid) {
    throw new Error(`微信登录失败：${json.errmsg || "未知错误"}`);
  }
  return { openid: json.openid, sessionKey: json.session_key };
}

// 微信支付 JSAPI 下单，返回 wx.requestPayment 所需参数
export async function createJsapiPayment(
  order: { orderNo: string; totalAmount: number },
  openid: string
): Promise<Record<string, string>> {
  if (!wxPayConfigured()) throw new Error("微信支付未配置");
  const path = "/v3/pay/transactions/jsapi";
  const body = JSON.stringify({
    appid: APPID,
    mchid: MCH_ID,
    description: `咖啡订单 ${order.orderNo}`,
    out_trade_no: order.orderNo,
    notify_url: NOTIFY_URL,
    amount: { total: Math.round(Number(order.totalAmount) * 100) },
    payer: { openid },
  });
  const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader("POST", path, body),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
  const json = await res.json();
  if (!json.prepay_id) {
    throw new Error(`微信下单失败：${json.message || json.code || "未知错误"}`);
  }
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonce = nonceStr();
  const pkg = `prepay_id=${json.prepay_id}`;
  const signMessage = `${APPID}\n${timeStamp}\n${nonce}\n${pkg}\n`;
  return {
    timeStamp,
    nonceStr: nonce,
    package: pkg,
    signType: "RSA",
    paySign: rsaSign(signMessage),
  };
}

// 微信 access_token（缓存 100 分钟）
let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`获取 access_token 失败：${json.errmsg || "未知错误"}`);
  }
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 7200) * 1000 - 5 * 60_000,
  };
  return tokenCache.token;
}

// 发送订阅消息
export async function sendSubscribeMessage(
  openid: string,
  templateId: string,
  data: Record<string, { value: string }>,
  page = "pages/order/detail"
): Promise<void> {
  if (!wxMpConfigured()) throw new Error("微信小程序未配置");
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: openid,
        template_id: templateId,
        page,
        miniprogram_state: "formal",
        lang: "zh_CN",
        data,
      }),
    }
  );
  const json = await res.json();
  if (json.errcode !== 0) {
    throw new Error(`订阅消息发送失败：${json.errmsg || json.errcode}`);
  }
}

// 出餐时发送取餐通知（best-effort，失败仅记日志）
export async function sendOrderReadyNotify(order: { id: number; userId: number | null; pickupNo: string }): Promise<void> {
  if (!wxSubscribeConfigured() || !order.userId) return;
  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  if (!user?.wxOpenid) return;
  const sub = await prisma.userSubscribe.findUnique({
    where: { userId_templateId: { userId: order.userId, templateId: READY_TEMPLATE_ID } },
  });
  if (!sub || sub.status !== "ACCEPTED") return;
  await sendSubscribeMessage(
    user.wxOpenid,
    READY_TEMPLATE_ID,
    {
      thing1: { value: `取餐码 ${order.pickupNo}` },
      thing2: { value: "您的咖啡已做好，请到吧台取餐" },
    },
    `pages/order/detail?id=${order.id}`
  );
}
