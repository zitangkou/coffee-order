import type { NextFunction, Request, Response } from "express";
import { verify, type AdminPayload, type UserPayload } from "../lib/jwt.js";
import { fail } from "../lib/response.js";
import { prisma } from "../lib/prisma.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = token ? verify<AdminPayload>(token) : null;
  if (!payload || payload.type !== "admin") {
    return fail(res, "未授权", 401, 401);
  }
  (req as any).admin = payload;
  next();
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = token ? verify<UserPayload>(token) : null;
  if (!payload || payload.type !== "user") {
    return fail(res, "请先登录", 401, 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { status: true, tokenVersion: true },
  });
  if (!user || user.status !== "ACTIVE" || user.tokenVersion !== payload.ver) {
    return fail(res, "登录状态已失效，请重新登录", 401, 401);
  }
  (req as any).userId = payload.id;
  next();
}

export function requireManager(req: Request, res: Response, next: NextFunction) {
  const admin = (req as any).admin as AdminPayload | undefined;
  if (!admin || admin.role !== "MANAGER") {
    return fail(res, "无权限：仅店长可执行该操作", 403, 403);
  }
  next();
}
