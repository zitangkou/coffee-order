import { prisma } from "./prisma.js";

export function genOrderNo(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `CO${stamp}${Math.floor(100 + Math.random() * 900)}`;
}

export async function genPickupNo(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const n = 100 + Math.floor(Math.random() * 900);
    const candidate = `S${n}`;
    const exists = await prisma.order.findFirst({ where: { pickupNo: candidate } });
    if (!exists) return candidate;
  }
  return `S${Math.floor(100 + Math.random() * 900)}`;
}
