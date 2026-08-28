import type { NextFunction, Request, Response } from "express";
import { verify, type AdminPayload, type UserPayload } from "../lib/jwt.js";
import { fail } from "../lib/response.js";
import { prisma } from "../lib/prisma.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = token ? verify<AdminPayload>(token) : null;
  if (!payload || payload.type !== "admin") {
    return fail(res, "未授权", 401, 401);
  }
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, status: true, mustChangePassword: true, tokenVersion: true },
    });
    if (!admin || admin.status !== "ACTIVE" || admin.tokenVersion !== payload.ver) {
      return fail(res, "登录状态已失效，请重新登录", 401, 401);
    }
    if (admin.mustChangePassword && req.path !== "/password") {
      return fail(res, "首次登录或密码重置后必须先修改密码", 403, 403);
    }
    (req as any).admin = { id: admin.id, role: admin.role, ver: admin.tokenVersion, type: "admin" };
    next();
  } catch {
    return fail(res, "管理员身份校验失败", 500, 500);
  }
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
