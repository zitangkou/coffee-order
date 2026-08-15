import type { Prisma } from "@prisma/client";
import { genOrderNo, genPickupNo } from "../lib/ids.js";
import { stringifyJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";
import { calcUnitPrice, type SpecValue } from "./price.js";
import { printOrder } from "./printer.js";
import { sendOrderReadyNotify } from "./wechat.js";

export type OrderStatus =
  | "UNPAID"
  | "PAID"
  | "MAKING"
  | "READY"
  | "COMPLETED"
  | "REFUNDING"
  | "REFUNDED"
  | "CANCELLED";

export type OrderType = "DINE_IN" | "TAKEOUT";

export interface CreateOrderInput {
  userId?: number;
  tableId?: number;
  orderType: OrderType;
  items: { productId: number; quantity: number; specs: Record<string, SpecValue> }[];
  remark?: string;
  phone?: string;
}

const orderInclude = {
  items: true,
  table: true,
  payments: true,
  refunds: true,
} satisfies Prisma.OrderInclude;

export async function createOrder(input: CreateOrderInput) {
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true, isSoldOut: false },
    include: {
      specGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          specGroup: {
            include: {
              options: { orderBy: { sortOrder: "asc" }, where: { isActive: true } },
            },
          },
        },
      },
    },
  });
  if (products.length !== new Set(productIds).size) {
    throw new Error("存在已下架或售罄的商品");
  }
  const productMap = new Map(products.map((p) => [p.id, p]));
  const setting = await prisma.shopSetting.findFirst();
  const packFee =
    input.orderType === "TAKEOUT" && setting ? Number(setting.packFee) : 0;

  const items = input.items.map((it) => {
    const product = productMap.get(it.productId);
    if (!product) throw new Error("商品不存在");
    const specGroups = product.specGroups.map((psg: any) => ({
      name: psg.specGroup.name,
      type: psg.specGroup.type,
      required: psg.required,
      options: psg.specGroup.options,
    }));
    const unitPrice = calcUnitPrice({ price: Number(product.price), specGroups }, it.specs ?? {});
    const quantity = Math.max(1, Math.min(99, it.quantity || 1));
    return {
      productId: product.id,
      productName: product.name,
      specsDetail: stringifyJson(it.specs ?? {}),
      unitPrice,
      quantity,
      subtotal: Math.round(unitPrice * quantity * 100) / 100,
    };
  });
  const totalAmount =
    Math.round((items.reduce((s, i) => s + i.subtotal, 0) + packFee) * 100) / 100;

  let tableId: number | null = input.tableId ?? null;
  if (input.orderType === "DINE_IN" && tableId) {
    const table = await prisma.tableInfo.findFirst({
      where: { id: tableId, isActive: true },
    });
    if (!table) throw new Error("桌台不存在或已停用");
  } else {
    tableId = null;
  }

  return prisma.order.create({
    data: {
      orderNo: genOrderNo(),
      pickupNo: await genPickupNo(),
      userId: input.userId ?? null,
      tableId,
      orderType: input.orderType,
      status: "UNPAID",
      totalAmount,
      packFee,
      remark: input.remark || null,
      phone: input.phone || null,
      items: { create: items },
    },
    include: orderInclude,
  });
}

export async function mockPay(orderId: number, userId?: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (order.status !== "UNPAID") throw new Error("订单状态不允许支付");
  if (userId && order.userId && order.userId !== userId) {
    throw new Error("无权操作该订单");
  }
  await prisma.$transaction([
    prisma.payment.create({
      data: { orderId, amount: order.totalAmount, channel: "MOCK", status: "SUCCESS" },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID", paidAt: new Date() },
    }),
  ]);
  const updated = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (updated) await printOrder(updated);
  return updated;
}

export async function wechatPay(orderId: number) {
  // H5 开发阶段：微信支付预留；小程序阶段接入商户号统一下单
  return mockPay(orderId);
}

const transitions: Record<string, OrderStatus[]> = {
  UNPAID: ["CANCELLED"],
  PAID: ["MAKING", "CANCELLED"],
  MAKING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  REFUNDING: [],
  REFUNDED: [],
  CANCELLED: [],
};

export async function transitionOrder(orderId: number, status: OrderStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  const allowed = transitions[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(`订单状态不允许从 ${order.status} 变更为 ${status}`);
  }
  // 原子条件更新：两个店员同时接单/出餐时只有一个成功
  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status },
  });
  if (updated.count === 0) {
    throw new Error("订单状态已被其他操作更新，请刷新后重试");
  }
  const result = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  // 出餐时给已订阅的微信用户推送取餐通知（best-effort）
  if (status === "READY" && result) {
    sendOrderReadyNotify(result).catch((e) =>
      console.warn("[wx] 订阅消息发送失败:", e?.message)
    );
  }
  return result;
}

export async function requestRefund(
  orderId: number,
  userId: number | undefined,
  reason: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (userId && order.userId && order.userId !== userId) {
    throw new Error("无权操作该订单");
  }
  if (!["PAID", "MAKING", "READY", "COMPLETED"].includes(order.status)) {
    throw new Error("当前状态不可申请退款");
  }
  const setting = await prisma.shopSetting.findFirst();
  if (setting && !setting.refundEnabled) {
    throw new Error("店铺暂未开启退款申请");
  }
  await prisma.$transaction([
    prisma.refund.create({
      data: { orderId, reason: reason || "未填写原因", statusBefore: order.status },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: "REFUNDING" },
    }),
  ]);
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
}

export async function handleRefund(
  refundId: number,
  action: "APPROVED" | "REJECTED",
  adminId: number,
  rejectReason?: string
) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: true },
  });
  if (!refund || refund.status !== "PENDING") throw new Error("退款申请不存在或已处理");
  if (action === "REJECTED" && !rejectReason) {
    throw new Error("拒绝退款需填写原因");
  }
  const updated = await prisma.refund.updateMany({
    where: { id: refundId, status: "PENDING" },
    data: {
      status: action,
      handledBy: adminId,
      handledAt: new Date(),
      rejectReason: rejectReason || null,
    },
  });
  if (updated.count === 0) {
    throw new Error("退款申请已被其他操作处理，请刷新后重试");
  }
  await prisma.order.update({
    where: { id: refund.orderId },
    data:
      action === "APPROVED"
        ? { status: "REFUNDED", refundedAt: new Date() }
        : { status: refund.statusBefore },
  });
  return prisma.refund.findUnique({ where: { id: refundId }, include: { order: true } });
}

export async function cancelStaleOrders() {
  const timeoutMin = Number(process.env.ORDER_TIMEOUT_MINUTES || 15);
  const cutoff = new Date(Date.now() - timeoutMin * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: "UNPAID", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const o of stale) {
    await prisma.order
      .update({ where: { id: o.id }, data: { status: "CANCELLED" } })
      .catch(() => undefined);
  }
  if (stale.length) {
    console.log(`[cron] 自动取消 ${stale.length} 个超时未支付订单`);
  }
  return stale.length;
}
