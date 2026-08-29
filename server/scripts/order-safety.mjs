// 不依赖微信凭据，验证下单幂等和按北京时间营业日生成的唯一取餐码。
import "dotenv/config";

const { prisma } = await import("../dist/lib/prisma.js");
const { businessDate } = await import("../dist/lib/ids.js");
const { createOrder } = await import("../dist/services/order.js");

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const date = businessDate();
let userId;
let categoryId;
let productId;
let previousSequence = null;
let previousAcceptOrders;

try {
  const currentSetting = await prisma.shopSetting.findFirst();
  if (currentSetting) {
    previousAcceptOrders = currentSetting.acceptOrders;
    await prisma.shopSetting.update({ where: { id: currentSetting.id }, data: { acceptOrders: true } });
  }
  previousSequence = await prisma.dailySequence.findUnique({ where: { businessDate: date } });

  const user = await prisma.user.create({
    data: { openid: `order-safety-${suffix}`, nickname: "下单幂等测试" },
  });
  userId = user.id;
  const category = await prisma.category.create({ data: { name: `测试分类${suffix}` } });
  categoryId = category.id;
  const product = await prisma.product.create({
    data: { categoryId, name: `测试商品${suffix}`, price: 9.9, isActive: true, isSoldOut: false },
  });
  productId = product.id;

  const request = {
    userId,
    clientRequestId: `idem_${suffix}`.slice(0, 64),
    orderType: "TAKEOUT",
    items: [{ productId, quantity: 1, specs: {} }],
  };
  const concurrent = await Promise.all([createOrder(request), createOrder(request)]);
  if (concurrent[0].id !== concurrent[1].id) throw new Error("并发同幂等键生成了多笔订单");
  const repeated = await createOrder(request);
  if (repeated.id !== concurrent[0].id) throw new Error("重复请求未返回原订单");
  const count = await prisma.order.count({
    where: { userId, clientRequestId: request.clientRequestId },
  });
  if (count !== 1) throw new Error(`同幂等键生成了 ${count} 笔订单`);

  const second = await createOrder({ ...request, clientRequestId: `idem2_${suffix}`.slice(0, 64) });
  if (!concurrent[0].pickupKey || !second.pickupKey) throw new Error("新订单缺少唯一取餐键");
  if (concurrent[0].pickupKey === second.pickupKey || concurrent[0].pickupNo === second.pickupNo) {
    throw new Error("同营业日取餐码发生重复");
  }
  if (concurrent[0].businessDate !== date || second.businessDate !== date) {
    throw new Error("订单营业日不是北京时间日期");
  }
  if (businessDate(new Date("2026-08-29T15:59:59Z")) !== "20260829") {
    throw new Error("北京时间跨日前日期计算错误");
  }
  if (businessDate(new Date("2026-08-29T16:00:00Z")) !== "20260830") {
    throw new Error("北京时间跨日后日期计算错误");
  }

  console.log("[order-safety] ✓ 并发幂等、唯一取餐码及北京时间营业日验证通过");
} finally {
  if (userId) {
    const orders = await prisma.order.findMany({ where: { userId }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
  }
  if (productId) await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  if (previousSequence) {
    await prisma.dailySequence.update({
      where: { businessDate: date },
      data: { pickupValue: previousSequence.pickupValue },
    });
  } else {
    await prisma.dailySequence.delete({ where: { businessDate: date } }).catch(() => undefined);
  }
  if (previousAcceptOrders !== undefined) {
    const setting = await prisma.shopSetting.findFirst();
    if (setting) {
      await prisma.shopSetting.update({ where: { id: setting.id }, data: { acceptOrders: previousAcceptOrders } });
    }
  }
  await prisma.$disconnect();
}
