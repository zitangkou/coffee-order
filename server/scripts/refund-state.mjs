// 不依赖微信凭据，验证退款处理中/失败/成功的数据库状态机。
import "dotenv/config";

const { prisma } = await import("../dist/lib/prisma.js");
const { confirmWechatRefund } = await import("../dist/services/payment.js");
const { requestRefund } = await import("../dist/services/order.js");

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const orderNo = `STATE${Date.now()}`.slice(0, 32);
const outRefundNo = `RF_STATE_${suffix}`.slice(0, 64);
let orderId;
let concurrentOrderId;
let testUserId;

try {
  const order = await prisma.order.create({
    data: {
      orderNo,
      pickupNo: "T001",
      orderType: "TAKEOUT",
      status: "REFUNDING",
      totalAmount: 12.34,
    },
  });
  orderId = order.id;
  const refund = await prisma.refund.create({
    data: {
      orderId: order.id,
      reason: "状态机自动测试",
      status: "PROCESSING",
      statusBefore: "PAID",
      outRefundNo,
      refundAmount: 12.34,
    },
  });

  await confirmWechatRefund({
    out_refund_no: outRefundNo,
    out_trade_no: orderNo,
    refund_status: "PROCESSING",
    amount: { refund: 1234 },
  });
  let current = await prisma.refund.findUnique({ where: { id: refund.id } });
  if (current?.status !== "PROCESSING") throw new Error("PROCESSING 状态未保持");

  await confirmWechatRefund({
    out_refund_no: outRefundNo,
    out_trade_no: orderNo,
    refund_status: "ABNORMAL",
    refund_id: "TEST_FAILED",
    amount: { refund: 1234 },
  });
  current = await prisma.refund.findUnique({ where: { id: refund.id } });
  let currentOrder = await prisma.order.findUnique({ where: { id: order.id } });
  if (current?.status !== "FAILED" || currentOrder?.status !== "PAID") {
    throw new Error("退款异常后未恢复原订单状态");
  }

  await prisma.refund.update({ where: { id: refund.id }, data: { status: "PROCESSING" } });
  await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDING" } });
  const successEvent = {
    out_refund_no: outRefundNo,
    out_trade_no: orderNo,
    refund_status: "SUCCESS",
    refund_id: "TEST_SUCCESS",
    amount: { refund: 1234 },
  };
  await confirmWechatRefund(successEvent);
  await confirmWechatRefund(successEvent);
  current = await prisma.refund.findUnique({ where: { id: refund.id } });
  currentOrder = await prisma.order.findUnique({ where: { id: order.id } });
  if (current?.status !== "SUCCESS" || currentOrder?.status !== "REFUNDED") {
    throw new Error("退款成功状态未正确落库");
  }
  await confirmWechatRefund({
    out_refund_no: outRefundNo,
    out_trade_no: orderNo,
    refund_status: "ABNORMAL",
    refund_id: "TEST_LATE_FAILED",
    amount: { refund: 1234 },
  });
  current = await prisma.refund.findUnique({ where: { id: refund.id } });
  currentOrder = await prisma.order.findUnique({ where: { id: order.id } });
  if (current?.status !== "SUCCESS" || currentOrder?.status !== "REFUNDED") {
    throw new Error("乱序失败结果不应回退退款成功终态");
  }

  const testUser = await prisma.user.create({
    data: { openid: `refund-state-${suffix}`, nickname: "退款状态测试" },
  });
  testUserId = testUser.id;
  const concurrentOrder = await prisma.order.create({
    data: {
      orderNo: `CONCURRENT${Date.now()}`.slice(0, 32),
      pickupNo: "T002",
      userId: testUser.id,
      orderType: "TAKEOUT",
      status: "PAID",
      totalAmount: 8.88,
      paidAt: new Date(),
    },
  });
  concurrentOrderId = concurrentOrder.id;
  const attempts = await Promise.allSettled([
    requestRefund(concurrentOrder.id, testUser.id, "并发测试一"),
    requestRefund(concurrentOrder.id, testUser.id, "并发测试二"),
  ]);
  if (attempts.filter((item) => item.status === "fulfilled").length !== 1) {
    throw new Error("并发退款申请必须且只能成功一次");
  }
  const refundCount = await prisma.refund.count({ where: { orderId: concurrentOrder.id } });
  if (refundCount !== 1) throw new Error(`并发退款生成了 ${refundCount} 条记录`);
  console.log("[refund-state] ✓ 状态流转、终态单调、回调幂等及并发申请验证通过");
} finally {
  if (concurrentOrderId) {
    await prisma.refund.deleteMany({ where: { orderId: concurrentOrderId } });
    await prisma.order.delete({ where: { id: concurrentOrderId } }).catch(() => undefined);
  }
  if (testUserId) await prisma.user.delete({ where: { id: testUserId } }).catch(() => undefined);
  if (orderId) {
    await prisma.refund.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
