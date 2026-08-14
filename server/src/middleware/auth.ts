import type { NextFunction, Request, Response } from "express";
import { verify, type AdminPayload, type UserPayload } from "../lib/jwt.js";
import { fail } from "../lib/response.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = token ? verify<AdminPayload>(token) : null;
  if (!payload || payload.type !== "admin") {
    return fail(res, "未授权", 401, 401);
  }
  (req as any).admin = payload;
  next();
}

export function optionalUser(req: Request, _res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = token ? verify<UserPayload>(token) : null;
  if (payload && payload.type === "user") {
    (req as any).userId = payload.id;
  }
  next();
}
