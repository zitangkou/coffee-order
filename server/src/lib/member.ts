export interface MemberLevel {
  key: string;
  name: string;
  minSpend: number;
  badge: string;
}

// 轻会员等级：按累计消费自动升级
export const MEMBER_LEVELS: MemberLevel[] = [
  { key: "NEW", name: "咖啡新友", minSpend: 0, badge: "☕" },
  { key: "REGULAR", name: "咖啡常客", minSpend: 500, badge: "🥤" },
  { key: "VIP", name: "咖啡老友", minSpend: 1500, badge: "🎖️" },
  { key: "MASTER", name: "咖啡大师", minSpend: 3000, badge: "🏆" },
];

export function memberLevel(totalSpent: number) {
  let current = MEMBER_LEVELS[0];
  for (const l of MEMBER_LEVELS) {
    if (totalSpent >= l.minSpend) current = l;
  }
  const next = MEMBER_LEVELS.find((l) => l.minSpend > totalSpent) ?? null;
  const progress = next
    ? Math.min(
        100,
        Math.round(((totalSpent - current.minSpend) / (next.minSpend - current.minSpend)) * 100)
      )
    : 100;
  return { current, next, progress };
}
