// 不读取真实微信凭据，验证支付归属、幂等、单订单单支付和待支付订单取消。
process.env.WECHAT_MP_APPID = "wx_payment_safety_test";
process.env.WECHAT_MCH_ID = "1900000001";
process.env.PRINTER_ENABLED = "false";

const { prisma } = await import("../dist/lib/prisma.js");
const { confirmWechatPayment } = await import("../dist/services/payment.js");
const { cancelUnpaidOrder } = await import("../dist/services/order.js");

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let userId;
let otherUserId;

async function expectRejected(task, message) {
  try {
    await task();
  } catch {
    return;
  }
  throw new Error(message);
}

try {
  const user = await prisma.user.create({ data: { openid: `payment-safety-${suffix}` } });
  const otherUser = await prisma.user.create({ data: { openid: `payment-other-${suffix}` } });
  userId = user.id;
  otherUserId = otherUser.id;
  const order = await prisma.order.create({
    data: {
      orderNo: `PS${Date.now()}A`,
      pickupNo: "T001",
      userId,
      orderType: "TAKEOUT",
      totalAmount: 12.34,
    },
  });
  const event = {
    trade_state: "SUCCESS",
    appid: process.env.WECHAT_MP_APPID,
    mchid: process.env.WECHAT_MCH_ID,
    out_trade_no: order.orderNo,
    transaction_id: `WX${suffix}`,
    amount: { total: 1234, currency: "CNY" },
  };

  await expectRejected(
    () => confirmWechatPayment({ ...event, appid: "wx_wrong" }),
    "错误 AppID 未被拒绝"
  );
  await expectRejected(
    () => confirmWechatPayment({ ...event, mchid: "wrong_mch" }),
    "错误商户号未被拒绝"
  );
  await expectRejected(
    () => confirmWechatPayment({ ...event, amount: { total: 1234, currency: "USD" } }),
    "错误币种未被拒绝"
  );
  await expectRejected(
    () => confirmWechatPayment({ ...event, amount: { total: 1, currency: "CNY" } }),
    "错误金额未被拒绝"
  );

  await confirmWechatPayment(event);
  await confirmWechatPayment(event);
  await expectRejected(
    () => confirmWechatPayment({ ...event, transaction_id: `WX_OTHER_${suffix}` }),
    "同一订单的第二个成功交易号未被拒绝"
  );
  const paid = await prisma.order.findUnique({ where: { id: order.id }, include: { payments: true } });
  if (paid?.status !== "PAID" || paid.payments.length !== 1) {
    throw new Error("支付确认没有保持单订单单支付记录");
  }

  const unpaid = await prisma.order.create({
    data: {
      orderNo: `PS${Date.now()}B`,
      pickupNo: "T002",
      userId,
      orderType: "TAKEOUT",
      totalAmount: 8.8,
    },
  });
  await expectRejected(
    () => cancelUnpaidOrder(unpaid.id, otherUserId),
    "其他用户能够取消订单"
  );
  const cancelled = await cancelUnpaidOrder(unpaid.id, userId);
  if (cancelled?.status !== "CANCELLED") throw new Error("待支付订单取消失败");

  console.log("[payment-safety] ✓ 支付归属、幂等、唯一支付和用户取消验证通过");
} finally {
  if (userId) {
    const orders = await prisma.order.findMany({ where: { userId }, select: { id: true } });
    const orderIds = orders.map((item) => item.id);
    if (orderIds.length) {
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
  }
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
  await prisma.$disconnect();
}
