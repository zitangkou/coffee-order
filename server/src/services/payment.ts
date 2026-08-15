import crypto from "node:crypto";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";

// 微信支付 v3 回调：验签 + 解密 + 金额校验 + 幂等处理。
// fail-closed：未配置商户证书/密钥时一律拒绝回调，绝不默认可通过。

function configReady(): boolean {
  return !!(process.env.WECHAT_API_V3_KEY && process.env.WECHAT_PLATFORM_CERT_PATH);
}

export function verifyWechatCallbackSignature(
  rawBody: Buffer,
  headers: Record<string, string>,
  platformCert: string
): boolean {
  const signature = headers["wechatpay-signature"];
  const timestamp = headers["wechatpay-timestamp"];
  const nonce = headers["wechatpay-nonce"];
  if (!signature || !timestamp || !nonce) return false;
  const message = `${timestamp}\n${nonce}\n${rawBody.toString("utf8")}\n`;
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(message);
    verifier.end();
    return verifier.verify(platformCert, signature, "base64");
  } catch {
    return false;
  }
}

function decryptResource(resource: any, apiV3Key: string): any {
  const key = Buffer.from(apiV3Key, "utf8");
  if (key.length !== 32) throw new Error("WECHAT_API_V3_KEY 必须是 32 字节");
  const buf = Buffer.from(resource.ciphertext, "base64");
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(resource.nonce, "utf8")
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

export async function handlePaymentCallback(
  rawBody: Buffer,
  headers: Record<string, string>
): Promise<{ code: string; message: string }> {
  if (!configReady()) {
    throw new Error("微信支付未配置，回调已拒绝");
  }
  const cert = fs.readFileSync(process.env.WECHAT_PLATFORM_CERT_PATH!, "utf8");
  if (!verifyWechatCallbackSignature(rawBody, headers, cert)) {
    throw new Error("微信支付回调验签失败");
  }

  const payload = JSON.parse(rawBody.toString("utf8"));
  const resource = payload?.resource;
  if (!resource) throw new Error("回调数据缺少 resource");
  const event = decryptResource(resource, process.env.WECHAT_API_V3_KEY!);

  if (event.trade_state !== "SUCCESS") {
    return { code: "SUCCESS", message: "非支付成功事件" };
  }

  const orderNo = String(event.out_trade_no || "");
  const txId = String(event.transaction_id || "");
  const paidFen = Number(event.amount?.total || 0);
  if (!orderNo || !txId) throw new Error("回调缺少订单号或交易号");

  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { payments: true },
  });
  if (!order) throw new Error("订单不存在");
  if (Math.round(Number(order.totalAmount) * 100) !== paidFen) {
    throw new Error("支付金额与订单金额不一致");
  }

  // 幂等：同一微信交易号已成功处理则直接返回成功
  const existing = order.payments.find(
    (p) => p.transactionId === txId && p.status === "SUCCESS"
  );
  if (existing) return { code: "SUCCESS", message: "已处理" };

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        orderId: order.id,
        transactionId: txId,
        amount: order.totalAmount,
        channel: "WECHAT",
        status: "SUCCESS",
      },
    }),
    prisma.order.updateMany({
      where: { id: order.id, status: "UNPAID" },
      data: { status: "PAID", paidAt: new Date() },
    }),
  ]);

  return { code: "SUCCESS", message: "成功" };
}
