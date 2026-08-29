import crypto from "node:crypto";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { printOrder } from "./printer.js";
import { queryWechatRefund, requestWechatRefund, wxPayConfigured } from "./wechat.js";

// 微信支付 v3 回调：验签 + 解密 + 金额校验 + 幂等处理。
// fail-closed：未配置商户证书/密钥时一律拒绝回调，绝不默认可通过。

function configReady(): boolean {
  return !!(
    process.env.WECHAT_MP_APPID &&
    process.env.WECHAT_MCH_ID &&
    process.env.WECHAT_API_V3_KEY &&
    process.env.WECHAT_PLATFORM_CERT_PATH
  );
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

function verifyAndDecryptCallback(
  rawBody: Buffer,
  headers: Record<string, string>
): any {
  if (!configReady()) throw new Error("微信支付未配置，回调已拒绝");
  let cert = "";
  try {
    cert = fs.readFileSync(process.env.WECHAT_PLATFORM_CERT_PATH!, "utf8");
  } catch {
    throw new Error("微信平台验签配置不可用");
  }
  if (!verifyWechatCallbackSignature(rawBody, headers, cert)) {
    throw new Error("微信支付回调验签失败");
  }
  const payload = JSON.parse(rawBody.toString("utf8"));
  if (!payload?.resource) throw new Error("回调数据缺少 resource");
  return decryptResource(payload.resource, process.env.WECHAT_API_V3_KEY!);
}

export async function handlePaymentCallback(
  rawBody: Buffer,
  headers: Record<string, string>
): Promise<{ code: string; message: string }> {
  const event = verifyAndDecryptCallback(rawBody, headers);

  if (event.trade_state !== "SUCCESS") {
    return { code: "SUCCESS", message: "非支付成功事件" };
  }

  await confirmWechatPayment(event);
  return { code: "SUCCESS", message: "成功" };
}

export async function handleRefundCallback(
  rawBody: Buffer,
  headers: Record<string, string>
): Promise<{ code: string; message: string }> {
  const event = verifyAndDecryptCallback(rawBody, headers);
  await confirmWechatRefund(event);
  return { code: "SUCCESS", message: "成功" };
}

export async function confirmWechatPayment(event: any): Promise<void> {
  if (event.trade_state !== "SUCCESS") throw new Error("微信订单尚未支付成功");
  const expectedAppId = String(process.env.WECHAT_MP_APPID || "");
  const expectedMchId = String(process.env.WECHAT_MCH_ID || "");
  if (!expectedAppId || !expectedMchId) throw new Error("微信支付商户归属配置不完整");
  if (String(event.appid || "") !== expectedAppId) throw new Error("支付结果 AppID 不匹配");
  if (String(event.mchid || "") !== expectedMchId) throw new Error("支付结果商户号不匹配");
  if (String(event.amount?.currency || "") !== "CNY") throw new Error("支付币种不是 CNY");
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
  if (existing) return;

  let newlyPaid = false;
  try {
    newlyPaid = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.payment.findFirst({ where: { transactionId: txId } });
      if (duplicate) {
        if (duplicate.orderId !== order.id) throw new Error("微信交易号已关联其他订单");
        return false;
      }
      const successfulPayment = await tx.payment.findUnique({ where: { orderId: order.id } });
      if (successfulPayment) {
        if (successfulPayment.transactionId !== txId) throw new Error("订单已有其他成功支付记录");
        return false;
      }
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["UNPAID", "CANCELLED"] } },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (updated.count === 0 && !["PAID", "MAKING", "READY", "COMPLETED"].includes(order.status)) {
        throw new Error(`订单状态 ${order.status} 不允许确认支付`);
      }
      await tx.payment.create({
        data: {
          orderId: order.id,
          transactionId: txId,
          amount: order.totalAmount,
          channel: "WECHAT",
          status: "SUCCESS",
        },
      });
      return true;
    });
  } catch (error: any) {
    // 并发重复回调可能同时越过读取，数据库唯一约束负责最终兜底。
    if (error?.code === "P2002") {
      const successfulPayment = await prisma.payment.findUnique({ where: { orderId: order.id } });
      if (successfulPayment?.transactionId === txId) return;
      throw new Error("订单已有其他成功支付记录");
    }
    throw error;
  }
  if (newlyPaid) {
    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, table: true, payments: true, refunds: true },
    });
    if (updated) {
      // 支付入账不能被打印机故障回滚；打印失败后续由告警/补打处理。
      await printOrder(updated).catch(() =>
        console.error(`[printer] 支付成功后出单失败: ${updated.orderNo}`)
      );
    }
  }
}

type RefundState = "PROCESSING" | "SUCCESS" | "FAILED";

function normalizeRefundState(status: string): RefundState {
  if (status === "SUCCESS") return "SUCCESS";
  if (status === "PROCESSING") return "PROCESSING";
  if (status === "CLOSED" || status === "ABNORMAL" || status === "FAILED") return "FAILED";
  throw new Error(`未知微信退款状态：${status || "EMPTY"}`);
}

export async function confirmWechatRefund(event: any): Promise<void> {
  const outRefundNo = String(event.out_refund_no || "");
  const state = normalizeRefundState(String(event.refund_status || event.status || ""));
  if (!outRefundNo) throw new Error("退款结果缺少商户退款单号");
  const refund = await prisma.refund.findUnique({
    where: { outRefundNo },
    include: { order: true },
  });
  if (!refund) throw new Error("退款申请不存在");
  if (event.out_trade_no && String(event.out_trade_no) !== refund.order.orderNo) {
    throw new Error("退款结果订单号不匹配");
  }
  const refundFen = Number(event.amount?.refund ?? 0);
  if (refundFen > 0 && Math.round(Number(refund.refundAmount || refund.order.totalAmount) * 100) !== refundFen) {
    throw new Error("退款结果金额不匹配");
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.refund.findUnique({ where: { id: refund.id } });
    if (!current) throw new Error("退款申请不存在");
    // 微信回调和主动查询可能乱序到达：成功是不可逆终态；失败只允许被后续成功纠正。
    if (current.status === "SUCCESS") return;
    if (current.status === "FAILED" && state !== "SUCCESS") return;
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: state,
        wechatRefundId: event.refund_id ? String(event.refund_id) : undefined,
        failureReason:
          state === "FAILED"
            ? String(event.refund_status || event.status || "退款关闭或异常").slice(0, 255)
            : null,
      },
    });
    if (state === "SUCCESS") {
      await tx.order.updateMany({
        where: { id: refund.orderId, status: "REFUNDING" },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
    } else if (state === "FAILED") {
      await tx.order.updateMany({
        where: { id: refund.orderId, status: "REFUNDING" },
        data: { status: refund.statusBefore as any },
      });
    }
  });
}

export async function submitWechatRefund(refundId: number, adminId: number): Promise<void> {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: { include: { payments: true } } },
  });
  if (!refund || refund.status !== "PENDING") throw new Error("退款申请不存在或已处理");
  const successfulPayment = refund.order.payments.find((item) => item.status === "SUCCESS");
  if (!successfulPayment) throw new Error("订单没有成功支付记录");
  const outRefundNo = refund.outRefundNo || `RF${refund.id}_${refund.order.orderNo}`;
  const amount = Number(refund.order.totalAmount);
  const claimed = await prisma.refund.updateMany({
    where: { id: refund.id, status: "PENDING" },
    data: {
      status: "PROCESSING",
      outRefundNo,
      refundAmount: amount,
      handledBy: adminId,
      handledAt: new Date(),
      failureReason: null,
    },
  });
  if (claimed.count !== 1) throw new Error("退款申请已被其他操作处理，请刷新后重试");

  if (successfulPayment.channel === "MOCK" && process.env.MOCK_PAYMENT === "true") {
    await confirmWechatRefund({
      out_refund_no: outRefundNo,
      out_trade_no: refund.order.orderNo,
      refund_status: "SUCCESS",
      refund_id: `MOCK_REFUND_${refund.id}`,
      amount: { refund: Math.round(amount * 100) },
    });
    return;
  }
  if (successfulPayment.channel !== "WECHAT") {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "PENDING" } });
    throw new Error("当前支付渠道暂不支持自动退款");
  }

  try {
    const result = await requestWechatRefund({
      orderNo: refund.order.orderNo,
      outRefundNo,
      reason: refund.reason,
      totalFen: Math.round(Number(refund.order.totalAmount) * 100),
      refundFen: Math.round(amount * 100),
    });
    await confirmWechatRefund({ ...result, out_refund_no: outRefundNo, out_trade_no: refund.order.orderNo });
  } catch (error: any) {
    await prisma.refund.updateMany({
      where: { id: refund.id, status: "PROCESSING" },
      data: { status: "PENDING", failureReason: String(error?.message || "退款申请失败").slice(0, 255) },
    });
    throw error;
  }
}

export async function syncWechatRefund(refundId: number): Promise<void> {
  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund?.outRefundNo) throw new Error("退款尚未提交微信");
  const result = await queryWechatRefund(refund.outRefundNo);
  await confirmWechatRefund({ ...result, out_refund_no: refund.outRefundNo });
}

export async function syncProcessingWechatRefunds(): Promise<number> {
  if (!wxPayConfigured()) return 0;
  const cutoff = new Date(Date.now() - 60_000);
  const refunds = await prisma.refund.findMany({
    where: { status: "PROCESSING", outRefundNo: { not: null }, updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: { id: true },
  });
  let synced = 0;
  for (const refund of refunds) {
    try {
      await syncWechatRefund(refund.id);
      synced += 1;
    } catch (error: any) {
      console.warn(`[refund-sync] 退款状态同步失败: ${error?.message || "未知错误"}`);
    }
  }
  return synced;
}
