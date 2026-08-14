import { Router } from "express";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";
import { num, str } from "../lib/validate.js";
import { fail, ok } from "../lib/response.js";
import { signAdmin } from "../lib/jwt.js";
import { parseJson, serializeOrder, serializeProduct, stringifyJson } from "../lib/json.js";
import { requireAdmin } from "../middleware/auth.js";
import { handleRefund, transitionOrder } from "../services/order.js";
import {
  hourlyDistribution,
  productRanking,
  summary,
  todayStats,
} from "../services/stats.js";

const router = Router();

router.post("/login", async (req, res) => {
  const username = str(req.body?.username).trim();
  const password = str(req.body?.password);
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
    return fail(res, "用户名或密码错误", 401, 401);
  }
  ok(res, { token: signAdmin({ id: admin.id, role: admin.role }), admin: { id: admin.id, username: admin.username, role: admin.role } });
});

router.get("/stats/today", requireAdmin, async (_req, res) => ok(res, await todayStats()));
router.get("/stats/summary", requireAdmin, async (req, res) => {
  const unit = (str(req.query.range) || "today") as "today" | "week" | "month";
  ok(res, await summary(unit));
});
router.get("/stats/products", requireAdmin, async (req, res) => {
  const unit = (str(req.query.range) || "today") as "today" | "week" | "month";
  ok(res, await productRanking(unit));
});
router.get("/stats/hours", requireAdmin, async (req, res) => {
  const date = req.query.date ? new Date(str(req.query.date)) : new Date();
  ok(res, await hourlyDistribution(date));
});

router.get("/orders", requireAdmin, async (req, res) => {
  const status = str(req.query.status);
  const page = Math.max(1, num(req.query.page, 1));
  const pageSize = Math.min(50, Math.max(1, num(req.query.pageSize, 20)));
  const where = status ? { status: status as any } : {};
  const [list, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true, table: true },
    }),
    prisma.order.count({ where }),
  ]);
  ok(res, { list: list.map(serializeOrder), total, page, pageSize });
});

router.get("/orders/:id", requireAdmin, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: num(req.params.id) },
    include: { items: true, table: true, payments: true, refunds: { include: { admin: true } } },
  });
  if (!order) return fail(res, "订单不存在");
  ok(res, serializeOrder(order));
});

router.patch("/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const order = await transitionOrder(num(req.params.id), str(req.body?.status) as any);
    ok(res, serializeOrder(order), "状态已更新");
  } catch (e: any) {
    fail(res, e?.message || "状态更新失败");
  }
});

router.get("/refunds", requireAdmin, async (_req, res) => {
  const refunds = await prisma.refund.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: { include: { items: true, table: true } } },
  });
  ok(
    res,
    refunds.map((r) => ({ ...r, order: r.order ? serializeOrder(r.order) : null }))
  );
});

router.put("/refunds/:id", requireAdmin, async (req, res) => {
  const action = str(req.body?.action).toUpperCase();
  if (action !== "APPROVED" && action !== "REJECTED") {
    return fail(res, "action 必须为 approved 或 rejected");
  }
  try {
    const refund = await handleRefund(
      num(req.params.id),
      action as "APPROVED" | "REJECTED",
      (req as any).admin.id,
      str(req.body?.rejectReason)
    );
    ok(res, refund, action === "APPROVED" ? "已同意退款" : "已拒绝退款");
  } catch (e: any) {
    fail(res, e?.message || "退款处理失败");
  }
});

router.get("/categories", requireAdmin, async (_req, res) => {
  ok(
    res,
    (await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { products: true } })).map(
      (c) => ({ ...c, products: c.products.map(serializeProduct) })
    )
  );
});

router.post("/categories", requireAdmin, async (req, res) => {
  const name = str(req.body?.name).trim();
  if (!name) return fail(res, "分类名称不能为空");
  const category = await prisma.category.create({
    data: { name, sortOrder: num(req.body?.sortOrder) },
  });
  ok(res, category, "分类已创建");
});

router.put("/categories/:id", requireAdmin, async (req, res) => {
  const category = await prisma.category.update({
    where: { id: num(req.params.id) },
    data: {
      name: str(req.body?.name).trim() || undefined,
      sortOrder: req.body?.sortOrder !== undefined ? num(req.body.sortOrder) : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
    },
  });
  ok(res, category, "分类已更新");
});

router.delete("/categories/:id", requireAdmin, async (req, res) => {
  const count = await prisma.product.count({ where: { categoryId: num(req.params.id) } });
  if (count > 0) return fail(res, "该分类下仍有商品，无法删除");
  await prisma.category.delete({ where: { id: num(req.params.id) } });
  ok(res, null, "分类已删除");
});

router.get("/products", requireAdmin, async (_req, res) => {
  ok(
    res,
    (await prisma.product.findMany({
      orderBy: { sortOrder: "asc" },
      include: { category: true },
    })).map(serializeProduct)
  );
});

router.post("/products", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  if (!str(body.name).trim()) return fail(res, "商品名称不能为空");
  const product = await prisma.product.create({
    data: {
      categoryId: num(body.categoryId),
      name: str(body.name).trim(),
      nameEn: body.nameEn ? str(body.nameEn) : null,
      description: body.description ? str(body.description) : null,
      flavorNotes: body.flavorNotes ? str(body.flavorNotes) : null,
      origin: body.origin ? str(body.origin) : null,
      roastLevel: body.roastLevel ? str(body.roastLevel) : null,
      imageUrl: body.imageUrl ? str(body.imageUrl) : null,
      price: num(body.price),
      specsJson: stringifyJson(body.specsJson ?? {}),
      sortOrder: num(body.sortOrder),
      isSoldOut: body.isSoldOut === true,
      isActive: body.isActive !== false,
    },
  });
  ok(res, serializeProduct(product), "商品已创建");
});

router.put("/products/:id", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  const product = await prisma.product.update({
    where: { id: num(req.params.id) },
    data: {
      categoryId: body.categoryId !== undefined ? num(body.categoryId) : undefined,
      name: body.name !== undefined ? str(body.name).trim() : undefined,
      nameEn: body.nameEn !== undefined ? (str(body.nameEn) || null) : undefined,
      description: body.description !== undefined ? (str(body.description) || null) : undefined,
      flavorNotes: body.flavorNotes !== undefined ? (str(body.flavorNotes) || null) : undefined,
      origin: body.origin !== undefined ? (str(body.origin) || null) : undefined,
      roastLevel: body.roastLevel !== undefined ? (str(body.roastLevel) || null) : undefined,
      imageUrl: body.imageUrl !== undefined ? (str(body.imageUrl) || null) : undefined,
      price: body.price !== undefined ? num(body.price) : undefined,
      specsJson: body.specsJson !== undefined ? stringifyJson(body.specsJson) : undefined,
      sortOrder: body.sortOrder !== undefined ? num(body.sortOrder) : undefined,
      isSoldOut: typeof body.isSoldOut === "boolean" ? body.isSoldOut : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
  });
  ok(res, serializeProduct(product), "商品已更新");
});

router.patch("/products/:id/sold-out", requireAdmin, async (req, res) => {
  const product = await prisma.product.update({
    where: { id: num(req.params.id) },
    data: { isSoldOut: req.body?.soldOut === true },
  });
  ok(res, serializeProduct(product), product.isSoldOut ? "已标记售罄" : "已恢复在售");
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  await prisma.product.delete({ where: { id: num(req.params.id) } });
  ok(res, null, "商品已删除");
});

router.get("/tables", requireAdmin, async (_req, res) => {
  ok(res, await prisma.tableInfo.findMany({ orderBy: { tableNo: "asc" } }));
});

router.post("/tables", requireAdmin, async (req, res) => {
  const tableNo = str(req.body?.tableNo).trim();
  if (!tableNo) return fail(res, "桌号不能为空");
  const table = await prisma.tableInfo.create({ data: { tableNo } });
  ok(res, table, "桌台已创建");
});

router.put("/tables/:id", requireAdmin, async (req, res) => {
  const table = await prisma.tableInfo.update({
    where: { id: num(req.params.id) },
    data: {
      tableNo: req.body?.tableNo !== undefined ? str(req.body.tableNo).trim() : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
    },
  });
  ok(res, table, "桌台已更新");
});

router.delete("/tables/:id", requireAdmin, async (req, res) => {
  await prisma.tableInfo.delete({ where: { id: num(req.params.id) } });
  ok(res, null, "桌台已删除");
});

router.post("/tables/:id/qrcode", requireAdmin, async (req, res) => {
  const table = await prisma.tableInfo.findUnique({ where: { id: num(req.params.id) } });
  if (!table) return fail(res, "桌台不存在");
  const webBase = process.env.WEB_BASE_URL || "http://localhost:5173";
  const url = `${webBase}/#/pages/index/index?table_id=${table.id}`;
  const dir = path.resolve(process.cwd(), "uploads/qr");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `table-${table.id}.png`);
  await QRCode.toFile(file, url, { width: 600, margin: 1 });
  const qrUrl = `/uploads/qr/table-${table.id}.png`;
  await prisma.tableInfo.update({ where: { id: table.id }, data: { qrCodeUrl: qrUrl } });
  ok(res, { qrUrl, url, tableNo: table.tableNo }, "二维码已生成");
});

router.get("/settings", requireAdmin, async (_req, res) => {
  const setting = await prisma.shopSetting.findFirst();
  ok(
    res,
    setting ? { ...setting, printerConfig: parseJson(setting.printerConfig, null) } : null
  );
});

router.put("/settings", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  const current = await prisma.shopSetting.findFirst();
  const setting = await prisma.shopSetting.upsert({
    where: { id: current?.id ?? 1 },
    create: { id: 1, name: str(body.name) || "Coffee OS" },
    update: {
      name: body.name !== undefined ? str(body.name) : undefined,
      slogan: body.slogan !== undefined ? (str(body.slogan) || null) : undefined,
      logoUrl: body.logoUrl !== undefined ? (str(body.logoUrl) || null) : undefined,
      announcement: body.announcement !== undefined ? (str(body.announcement) || null) : undefined,
      businessHours: body.businessHours !== undefined ? (str(body.businessHours) || null) : undefined,
      acceptOrders: typeof body.acceptOrders === "boolean" ? body.acceptOrders : undefined,
      dineInEnabled: typeof body.dineInEnabled === "boolean" ? body.dineInEnabled : undefined,
      takeoutEnabled: typeof body.takeoutEnabled === "boolean" ? body.takeoutEnabled : undefined,
      packFee: body.packFee !== undefined ? num(body.packFee) : undefined,
      refundEnabled: typeof body.refundEnabled === "boolean" ? body.refundEnabled : undefined,
      takeoutPhoneRequired: typeof body.takeoutPhoneRequired === "boolean" ? body.takeoutPhoneRequired : undefined,
      printerConfig:
        body.printerConfig !== undefined ? stringifyJson(body.printerConfig) : undefined,
    },
  });
  ok(
    res,
    { ...setting, printerConfig: parseJson(setting.printerConfig, null) },
    "设置已保存"
  );
});

router.post("/printer/test", requireAdmin, async (_req, res) => {
  console.log("[printer] 测试打印请求已接收");
  ok(res, { sent: true }, "测试打印已发送");
});

export default router;
