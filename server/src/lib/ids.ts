import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";

export function genOrderNo(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `CO${stamp}${crypto.randomBytes(4).toString("hex")}`;
}

export function businessDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.BUSINESS_TIMEZONE || "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

export async function nextPickupIdentity(tx: Prisma.TransactionClient): Promise<{
  pickupNo: string;
  pickupKey: string;
  businessDate: string;
}> {
  const date = businessDate();
  const sequence = await tx.dailySequence.upsert({
    where: { businessDate: date },
    create: { businessDate: date, pickupValue: 1 },
    update: { pickupValue: { increment: 1 } },
  });
  const pickupNo = `S${String(sequence.pickupValue).padStart(3, "0")}`;
  return { pickupNo, pickupKey: `${date}:${pickupNo}`, businessDate: date };
}
