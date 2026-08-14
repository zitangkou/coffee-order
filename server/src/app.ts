import express from "express";
import cors from "cors";
import path from "node:path";
import { fail } from "./lib/response.js";
import customerRouter from "./routes/customer.js";
import adminRouter from "./routes/admin.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.get("/api/health", (_req, res) => res.json({ code: 0, data: { ok: true }, msg: "success" }));
  app.use("/api", customerRouter);
  app.use("/api/admin", adminRouter);
  app.use((req, res) => fail(res, `Not Found: ${req.path}`, 404, 404));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[error]", err);
    fail(res, err?.message || "服务器错误", 500, 500);
  });
  return app;
}
