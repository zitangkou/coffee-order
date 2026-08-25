import express from "express";
import cors from "cors";
import path from "node:path";
import { fail } from "./lib/response.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import customerRouter from "./routes/customer.js";
import adminRouter from "./routes/admin.js";

export function createApp() {
  const app = express();
  const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS || (process.env.NODE_ENV === "production" ? 2 : 0));
  if (!Number.isInteger(configuredProxyHops) || configuredProxyHops < 0 || configuredProxyHops > 10) {
    throw new Error("TRUST_PROXY_HOPS 必须是 0-10 的整数");
  }
  if (configuredProxyHops > 0) app.set("trust proxy", configuredProxyHops);
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.WEB_BASE_URL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, callback) {
        // 小程序及服务间请求通常不携带 Origin；浏览器请求仅允许配置的站点。
        if (!origin || process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error("CORS origin not allowed"));
      },
    })
  );
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        // 保留原始请求体，供微信支付回调验签使用
        (req as any).rawBody = buf;
      },
    })
  );
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.get("/api/health", (_req, res) => res.json({ code: 0, data: { ok: true }, msg: "success" }));
  app.use("/api", apiLimiter());
  app.use("/api", customerRouter);
  app.use("/api/admin", adminRouter);
  app.use((req, res) => fail(res, `Not Found: ${req.path}`, 404, 404));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[error]", err);
    fail(res, err?.message || "服务器错误", 500, 500);
  });
  return app;
}
