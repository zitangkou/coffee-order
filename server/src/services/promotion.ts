import { parseJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";

type PromotionConfig = {
  threshold?: number;
  reduction?: number;
  rate?: number;
  weekdays?: number[];
};

export async function applyBestPromotion(userId: number, originalAmount: number) {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
  });
  const paidCount = await prisma.order.count({
    where: { userId, status: { in: ["PAID", "MAKING", "READY", "COMPLETED", "REFUNDED"] } },
  });
  const weekday = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" })
      .formatToParts(now)
      .find((part) => part.type === "weekday")?.value
      ?.replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (value) => String(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value) || 7)) || 0
  );
  let best: { name: string; discount: number } | null = null;
  for (const promotion of promotions) {
    const config = parseJson<PromotionConfig>(promotion.config, {});
    let discount = 0;
    if (promotion.type === "FULL_REDUCTION" && originalAmount >= Number(config.threshold || 0)) {
      discount = Number(config.reduction || 0);
    } else if (promotion.type === "PERCENT") {
      const rate = Number(config.rate || 1);
      if (rate > 0 && rate < 1) discount = originalAmount * (1 - rate);
    } else if (promotion.type === "NEW_CUSTOMER" && paidCount === 0) {
      discount = Number(config.reduction || 0);
    } else if (promotion.type === "MEMBER_DAY" && config.weekdays?.includes(weekday)) {
      const rate = Number(config.rate || 1);
      if (rate > 0 && rate < 1) discount = originalAmount * (1 - rate);
    }
    discount = Math.min(originalAmount, Math.max(0, Math.round(discount * 100) / 100));
    if (discount > (best?.discount || 0)) best = { name: promotion.name, discount };
  }
  return best ?? { name: "", discount: 0 };
}
