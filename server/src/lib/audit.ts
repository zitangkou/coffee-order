import { prisma } from "./prisma.js";

export async function logAudit(
  adminId: number | undefined,
  action: string,
  targetType?: string,
  targetId?: number,
  detail?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        detail: detail ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] 写入失败", e);
  }
}
