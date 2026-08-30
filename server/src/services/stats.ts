import { prisma } from "../lib/prisma.js";
import {
  businessDateLabel,
  businessDayRange,
  businessHour,
  businessRange,
  shiftBusinessDate,
} from "../lib/businessTime.js";

const PAID_STATUSES = ["PAID", "MAKING", "READY", "COMPLETED"] as const;

function rangeFor(unit: "today" | "week" | "month") {
  return businessRange(unit);
}

export async function paidOrdersBetween(start: Date, end: Date) {
  return prisma.order.findMany({
    where: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: start, lte: end } },
    include: { items: true },
  });
}

export async function todayStats() {
  const { start, end } = businessDayRange();
  const orders = await paidOrdersBetween(start, end);
  const revenue = Math.round(orders.reduce((s, o) => s + Number(o.totalAmount), 0) * 100) / 100;
  return {
    revenue,
    orderCount: orders.length,
    avgTicket: orders.length ? Math.round((revenue / orders.length) * 100) / 100 : 0,
    pending: await prisma.order.count({ where: { status: "PAID" } }),
    making: await prisma.order.count({ where: { status: "MAKING" } }),
    ready: await prisma.order.count({ where: { status: "READY" } }),
  };
}

export async function summary(unit: "today" | "week" | "month") {
  const { start, end } = rangeFor(unit);
  const orders = await paidOrdersBetween(start, end);
  const revenue = Math.round(orders.reduce((s, o) => s + Number(o.totalAmount), 0) * 100) / 100;
  return {
    range: unit,
    revenue,
    orderCount: orders.length,
    avgTicket: orders.length ? Math.round((revenue / orders.length) * 100) / 100 : 0,
  };
}

export async function productRanking(unit: "today" | "week" | "month" = "today") {
  const { start, end } = rangeFor(unit);
  const orders = await paidOrdersBetween(start, end);
  const map = new Map<number, { name: string; qty: number; amount: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const cur = map.get(item.productId) ?? {
        name: item.productName,
        qty: 0,
        amount: 0,
      };
      cur.qty += item.quantity;
      cur.amount += Number(item.subtotal);
      map.set(item.productId, cur);
    }
  }
  return [...map.entries()]
    .map(([productId, v]) => ({
      productId,
      name: v.name,
      qty: v.qty,
      amount: Math.round(v.amount * 100) / 100,
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
}

export async function hourlyDistribution(date = new Date()) {
  const { start, end } = businessDayRange(date);
  const orders = await paidOrdersBetween(start, end);
  const buckets = new Array(24).fill(0) as number[];
  for (const o of orders) {
    buckets[businessHour(o.createdAt)] += 1;
  }
  return buckets.map((count, hour) => ({ hour: `${String(hour).padStart(2, "0")}:00`, count }));
}

export async function trend(days: number) {
  const result: { date: string; revenue: number; orderCount: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = shiftBusinessDate(today, -i);
    const { start, end } = businessDayRange(d);
    const orders = await paidOrdersBetween(start, end);
    result.push({
      date: businessDateLabel(d),
      revenue: Math.round(orders.reduce((s, o) => s + Number(o.totalAmount), 0) * 100) / 100,
      orderCount: orders.length,
    });
  }
  return result;
}

export async function categoryShare(unit: "today" | "week" | "month" = "today") {
  const { start, end } = rangeFor(unit);
  const orders = await prisma.order.findMany({
    where: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: start, lte: end } },
    include: { items: { include: { product: { include: { category: true } } } } },
  });
  const map = new Map<string, { revenue: number; qty: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const cat = item.product?.category?.name ?? "未分类";
      const cur = map.get(cat) ?? { revenue: 0, qty: 0 };
      cur.revenue += Number(item.subtotal);
      cur.qty += item.quantity;
      map.set(cat, cur);
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      revenue: Math.round(v.revenue * 100) / 100,
      qty: v.qty,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function refundStats(unit: "today" | "week" | "month" = "today") {
  const { start, end } = rangeFor(unit);
  const refunds = await prisma.refund.findMany({
    where: {
      OR: [
        { status: "SUCCESS", updatedAt: { gte: start, lte: end } },
        { status: "APPROVED", handledAt: { gte: start, lte: end } },
      ],
    },
    include: { order: true },
  });
  const amount = refunds.reduce(
    (s, r) => s + Number(r.refundAmount ?? r.order?.totalAmount ?? 0),
    0
  );
  return {
    count: refunds.length,
    amount: Math.round(amount * 100) / 100,
  };
}
