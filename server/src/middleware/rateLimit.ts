import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

const disabled = process.env.RATE_LIMIT_DISABLED === "true";

function noop(_req: Request, _res: Response, next: NextFunction) {
  next();
}

// 全局限流：默认 300 次/分钟/IP，防刷与异常流量
export function apiLimiter() {
  if (disabled) return noop;
  return rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.API_RATE_LIMIT || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 429, data: null, msg: "请求过于频繁，请稍后再试" },
  });
}

// 登录限流：默认 5 次/15 分钟/IP，防暴力破解
export function loginLimiter() {
  if (disabled) return noop;
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: Number(process.env.LOGIN_RATE_LIMIT || 5),
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 429, data: null, msg: "登录尝试次数过多，请 15 分钟后再试" },
  });
}
