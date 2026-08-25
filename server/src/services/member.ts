import { prisma } from "../lib/prisma.js";
import { memberLevel } from "../lib/member.js";

const PAID_STATUSES = ["PAID", "MAKING", "READY", "COMPLETED"];

export async function memberProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: {
        where: { status: { in: PAID_STATUSES } },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
  if (!user || user.status !== "ACTIVE") throw new Error("用户不存在或已注销");

  const totalSpent =
    Math.round(user.orders.reduce((s, o) => s + Number(o.totalAmount), 0) * 100) / 100;
  const level = memberLevel(totalSpent);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      nickname: user.nickname,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    member: {
      level,
      totalSpent,
      orderCount: user.orders.length,
      lastOrderAt: user.orders[0]?.createdAt ?? null,
      recentOrders: user.orders.slice(0, 20).map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        createdAt: o.createdAt,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        items: o.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
      })),
    },
  };
}
