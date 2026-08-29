import type { Prisma } from "@prisma/client";
import { genOrderNo, nextPickupIdentity } from "../lib/ids.js";
import { stringifyJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";
import { calcUnitPrice, type SpecValue } from "./price.js";
import { printOrder } from "./printer.js";
import {
  closeJsapiPayment,
  queryJsapiPayment,
  sendOrderReadyNotify,
  wxPayConfigured,
} from "./wechat.js";
import { confirmWechatPayment, submitWechatRefund } from "./payment.js";

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
  clientRequestId?: string;
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

async function createOrderInternal(input: CreateOrderInput) {
  if (!input.userId) throw new Error("请先登录");
  const clientRequestId = String(input.clientRequestId || "").trim();
  if (clientRequestId && !/^[A-Za-z0-9_-]{8,64}$/.test(clientRequestId)) {
    throw new Error("下单幂等标识格式不正确");
  }
  if (clientRequestId) {
    const existing = await prisma.order.findUnique({
      where: { userId_clientRequestId: { userId: input.userId, clientRequestId } },
      include: orderInclude,
    });
    if (existing) return existing;
  }
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("订单至少需要一件商品");
  if (input.items.length > 50) throw new Error("单笔订单商品种类过多");
  for (const item of input.items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0) throw new Error("商品参数不正确");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error("单项商品数量必须为 1–20");
    }
  }
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
  if (setting && !setting.acceptOrders) throw new Error("店铺当前暂停接单");
  if (input.orderType === "DINE_IN" && setting && !setting.dineInEnabled) {
    throw new Error("店铺当前未开放堂食");
  }
  if (input.orderType === "TAKEOUT" && setting && !setting.takeoutEnabled) {
    throw new Error("店铺当前未开放外带");
  }
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
    const allowedGroupNames = new Set(specGroups.map((group: any) => group.name));
    for (const suppliedName of Object.keys(it.specs ?? {})) {
      if (!allowedGroupNames.has(suppliedName)) throw new Error(`${product.name} 包含无效规格`);
    }
    for (const group of specGroups) {
      const selected = it.specs?.[group.name];
      const values = selected == null ? [] : Array.isArray(selected) ? selected : [selected];
      if (group.required && values.length === 0) throw new Error(`${product.name} 请选择${group.name}`);
      if (group.type === "SINGLE" && values.length > 1) throw new Error(`${group.name}只能选择一项`);
      if (new Set(values).size !== values.length) throw new Error(`${group.name}包含重复选项`);
      const allowed = new Set(group.options.map((option: any) => option.label));
      if (values.some((value: string) => !allowed.has(value))) throw new Error(`${group.name}包含无效选项`);
    }
    const unitPrice = calcUnitPrice({ price: Number(product.price), specGroups }, it.specs ?? {});
    const quantity = it.quantity;
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
  if (input.orderType === "DINE_IN" && !tableId) {
    throw new Error("堂食订单请选择桌号");
  }
  if (input.orderType === "DINE_IN" && tableId) {
    const table = await prisma.tableInfo.findFirst({
      where: { id: tableId, isActive: true },
    });
    if (!table) throw new Error("桌台不存在或已停用");
  } else {
    tableId = null;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const pickup = await nextPickupIdentity(tx);
      return tx.order.create({
        data: {
          orderNo: genOrderNo(),
          ...pickup,
          clientRequestId: clientRequestId || null,
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
    });
  } catch (error: any) {
    if (error?.code === "P2002" && clientRequestId) {
      const existing = await prisma.order.findUnique({
        where: { userId_clientRequestId: { userId: input.userId, clientRequestId } },
        include: orderInclude,
      });
      if (existing) return existing;
    }
    throw error;
  }
}

const pendingOrderCreates = new Map<string, Promise<any>>();

export async function createOrder(input: CreateOrderInput) {
  const clientRequestId = String(input.clientRequestId || "").trim();
  const key = input.userId && clientRequestId ? `${input.userId}:${clientRequestId}` : "";
  if (!key) return createOrderInternal(input);
  const pending = pendingOrderCreates.get(key);
  if (pending) return pending;
  const request = createOrderInternal(input);
  pendingOrderCreates.set(key, request);
  try {
    return await request;
  } finally {
    if (pendingOrderCreates.get(key) === request) pendingOrderCreates.delete(key);
  }
}

export async function mockPay(orderId: number, userId?: number) {
  if (process.env.MOCK_PAYMENT !== "true") {
    throw new Error("模拟支付未启用");
  }
  if (!userId) throw new Error("请先登录");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (order.status !== "UNPAID") throw new Error("订单状态不允许支付");
  if (!order.userId || order.userId !== userId) {
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

export async function wechatPay(orderId: number, userId: number) {
  // H5 开发阶段：微信支付预留；小程序阶段接入商户号统一下单
  return mockPay(orderId, userId);
}

const transitions: Record<string, OrderStatus[]> = {
  UNPAID: ["CANCELLED"],
  PAID: ["MAKING"],
  MAKING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  REFUNDING: [],
  REFUNDED: [],
  CANCELLED: [],
};

async function closeUnpaidWechatOrder(orderNo: string): Promise<boolean> {
  if (!wxPayConfigured()) return true;
  try {
    await closeJsapiPayment(orderNo);
    return true;
  } catch (error: any) {
    if (error?.wechatCode === "ORDER_NOT_EXIST") return true;
    if (error?.wechatCode === "ORDERPAID") {
      const result = await queryJsapiPayment(orderNo);
      if (result.trade_state === "SUCCESS") await confirmWechatPayment(result);
      return false;
    }
    throw error;
  }
}

export async function transitionOrder(orderId: number, status: OrderStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  const allowed = transitions[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(`订单状态不允许从 ${order.status} 变更为 ${status}`);
  }
  if (order.status === "UNPAID" && status === "CANCELLED") {
    const closed = await closeUnpaidWechatOrder(order.orderNo);
    if (!closed) throw new Error("订单已支付，不能取消");
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
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) throw new Error("请填写退款原因");
  if (normalizedReason.length > 255) throw new Error("退款原因不能超过 255 个字符");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (!userId || !order.userId || order.userId !== userId) {
    throw new Error("无权操作该订单");
  }
  if (!["PAID", "MAKING", "READY", "COMPLETED"].includes(order.status)) {
    throw new Error("当前状态不可申请退款");
  }
  const setting = await prisma.shopSetting.findFirst();
  if (setting && !setting.refundEnabled) {
    throw new Error("店铺暂未开启退款申请");
  }
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, userId, status: order.status },
      data: { status: "REFUNDING" },
    });
    if (claimed.count !== 1) throw new Error("订单状态已变化，请刷新后重试");
    await tx.refund.create({
      data: { orderId, reason: normalizedReason, statusBefore: order.status },
    });
  });
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
  if (action === "APPROVED") {
    await submitWechatRefund(refundId, adminId);
  } else {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.refund.updateMany({
        where: { id: refundId, status: "PENDING" },
        data: {
          status: "REJECTED",
          handledBy: adminId,
          handledAt: new Date(),
          rejectReason: rejectReason || null,
        },
      });
      if (claimed.count !== 1) return false;
      await tx.order.updateMany({
        where: { id: refund.orderId, status: "REFUNDING" },
        data: { status: refund.statusBefore },
      });
      return true;
    });
    if (!updated) throw new Error("退款申请已被其他操作处理，请刷新后重试");
  }
  return prisma.refund.findUnique({ where: { id: refundId }, include: { order: true } });
}

export async function cancelStaleOrders() {
  const timeoutMin = Number(process.env.ORDER_TIMEOUT_MINUTES || 15);
  const cutoff = new Date(Date.now() - timeoutMin * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: "UNPAID", createdAt: { lt: cutoff } },
    select: { id: true, orderNo: true },
  });
  let cancelled = 0;
  for (const o of stale) {
    try {
      const closed = await closeUnpaidWechatOrder(o.orderNo);
      if (!closed) continue;
      const updated = await prisma.order.updateMany({
        where: { id: o.id, status: "UNPAID" },
        data: { status: "CANCELLED" },
      });
      cancelled += updated.count;
    } catch (error: any) {
      console.warn(`[cron] 微信关单失败，保留本地未支付状态: ${error?.message || "未知错误"}`);
    }
  }
  if (cancelled) {
    console.log(`[cron] 自动取消 ${cancelled} 个超时未支付订单`);
  }
  return cancelled;
}
