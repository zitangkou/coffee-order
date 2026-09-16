import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";
import { num, str } from "../lib/validate.js";
import { fail, ok } from "../lib/response.js";
import { signAdmin } from "../lib/jwt.js";
import { parseJson, serializeOrder, serializeProduct, stringifyJson } from "../lib/json.js";
import { requireAdmin, requireManager } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { logAudit } from "../lib/audit.js";
import { handleRefund, transitionOrder } from "../services/order.js";
import { syncWechatRefund } from "../services/payment.js";
import { createUnlimitedMiniProgramCode, getWechatReadiness } from "../services/wechat.js";
import { printOrder } from "../services/printer.js";
import {
  hourlyDistribution,
  hourlyDistributionBetween,
  productRanking,
  productRankingBetween,
  summary,
  todayStats,
  trend,
  categoryShare,
  categoryShareBetween,
  refundStats,
  customOverview,
} from "../services/stats.js";

const router = Router();

const specInclude = {
  specGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      specGroup: {
        include: {
          options: { orderBy: { sortOrder: "asc" }, where: { isActive: true } },
        },
      },
    },
  },
} as const;

// 商品图片上传：存储到 uploads/products，限制 5MB、仅图片
const uploadDir = path.resolve(process.cwd(), "uploads/products");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("只支持上传图片文件"));
  },
});

router.post("/login", loginLimiter(), async (req, res) => {
  const username = str(req.body?.username).trim();
  const password = str(req.body?.password);
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || admin.status === "DISABLED" || !bcrypt.compareSync(password, admin.passwordHash)) {
    return fail(res, "用户名或密码错误", 401, 401);
  }
  ok(res, {
    token: signAdmin({ id: admin.id, role: admin.role, ver: admin.tokenVersion }),
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      status: admin.status,
      mustChangePassword: admin.mustChangePassword,
    },
  });
});

router.get("/admins", requireAdmin, requireManager, async (_req, res) => {
  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  ok(res, admins);
});

router.post("/admins", requireAdmin, requireManager, async (req, res) => {
  const username = str(req.body?.username).trim();
  const password = str(req.body?.password);
  const role = str(req.body?.role) === "MANAGER" ? "MANAGER" : "STAFF";
  if (!username || password.length < 8) return fail(res, "用户名必填且密码至少 8 位");
  const exists = await prisma.admin.findUnique({ where: { username } });
  if (exists) return fail(res, "用户名已存在");
  const admin = await prisma.admin.create({
    data: { username, passwordHash: bcrypt.hashSync(password, 10), role, mustChangePassword: true },
  });
  await logAudit((req as any).admin.id, "ADMIN_CREATE", "Admin", admin.id, `${username}(${role})`);
  ok(res, { id: admin.id, username: admin.username, role: admin.role, status: admin.status }, "管理员已创建");
});

router.put("/admins/:id", requireAdmin, requireManager, async (req, res) => {
  const id = num(req.params.id);
  const body = req.body ?? {};
  if (id === (req as any).admin.id) {
    return fail(res, "不能修改自己的角色或状态");
  }
  const data: Record<string, unknown> = {};
  if (typeof body.role === "string") data.role = body.role === "MANAGER" ? "MANAGER" : "STAFF";
  if (typeof body.status === "string") {
    data.status = body.status === "DISABLED" ? "DISABLED" : "ACTIVE";
  }
  if (str(body.password)) {
    if (str(body.password).length < 8) return fail(res, "密码至少 8 位");
    data.passwordHash = bcrypt.hashSync(str(body.password), 10);
    data.mustChangePassword = true;
  }
  data.tokenVersion = { increment: 1 };
  const admin = await prisma.admin.update({ where: { id }, data });
  const changedFields = [
    typeof body.role === "string" ? "role" : null,
    typeof body.status === "string" ? "status" : null,
    str(body.password) ? "password" : null,
  ].filter(Boolean);
  await logAudit(
    (req as any).admin.id,
    "ADMIN_UPDATE",
    "Admin",
    id,
    `changed=${changedFields.join(",")}`
  );
  ok(res, { id: admin.id, username: admin.username, role: admin.role, status: admin.status }, "已更新");
});

router.get("/audit-logs", requireAdmin, requireManager, async (req, res) => {
  const take = Math.min(100, Math.max(1, num(req.query.limit, 50)));
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { admin: { select: { username: true } } },
  });
  ok(res, logs);
});

router.get("/system/status", requireAdmin, requireManager, async (_req, res) => {
  const checkedAt = new Date();
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  let disk: { totalBytes: number; freeBytes: number; usedPercent: number } | null = null;
  try {
    const stats = fs.statfsSync(process.cwd());
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    disk = { totalBytes, freeBytes, usedPercent: totalBytes ? Math.round((1 - freeBytes / totalBytes) * 1000) / 10 : 0 };
  } catch {
    disk = null;
  }
  const backupDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), "backups");
  let latestBackupAt: string | null = null;
  try {
    const entries = fs.readdirSync(backupDir).map((name) => fs.statSync(path.join(backupDir, name)).mtimeMs);
    if (entries.length) latestBackupAt = new Date(Math.max(...entries)).toISOString();
  } catch {
    latestBackupAt = null;
  }
  ok(res, {
    checkedAt: checkedAt.toISOString(),
    database,
    uptimeSeconds: Math.round(process.uptime()),
    memory: { rssBytes: process.memoryUsage().rss, totalBytes: os.totalmem(), freeBytes: os.freemem() },
    disk,
    latestBackupAt,
    environment: process.env.NODE_ENV || "development",
    printerEnabled: process.env.PRINTER_ENABLED === "true",
    wechat: getWechatReadiness(),
  });
});

router.get("/stats/today", requireAdmin, async (_req, res) => ok(res, await todayStats()));
router.get("/stats/summary", requireAdmin, async (req, res) => {
  const unit = (str(req.query.range) || "today") as "today" | "week" | "month";
  ok(res, await summary(unit));
});
router.get("/stats/products", requireAdmin, async (req, res) => {
  if (req.query.startAt && req.query.endAt) {
    const start = new Date(str(req.query.startAt));
    const end = new Date(str(req.query.endAt));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return fail(res, "统计时间范围不正确");
    return ok(res, await productRankingBetween(start, end));
  }
  const unit = (str(req.query.range) || "today") as "today" | "week" | "month";
  ok(res, await productRanking(unit));
});
router.get("/stats/hours", requireAdmin, async (req, res) => {
  if (req.query.startAt && req.query.endAt) {
    const start = new Date(str(req.query.startAt));
    const end = new Date(str(req.query.endAt));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return fail(res, "统计时间范围不正确");
    return ok(res, await hourlyDistributionBetween(start, end));
  }
  const date = req.query.date ? new Date(str(req.query.date)) : new Date();
  ok(res, await hourlyDistribution(date));
});

router.get("/stats/trend", requireAdmin, async (req, res) => {
  const days = Math.min(30, Math.max(3, num(req.query.days, 7)));
  ok(res, await trend(days));
});

router.get("/stats/categories", requireAdmin, async (req, res) => {
  if (req.query.startAt && req.query.endAt) {
    const start = new Date(str(req.query.startAt));
    const end = new Date(str(req.query.endAt));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return fail(res, "统计时间范围不正确");
    return ok(res, await categoryShareBetween(start, end));
  }
  const unit = (str(req.query.range) || "today") as "today" | "week" | "month";
  ok(res, await categoryShare(unit));
});

router.get("/stats/refunds", requireAdmin, async (req, res) => {
  const unit = (str(req.query.range) || "today") as "today" | "week" | "month";
  ok(res, await refundStats(unit));
});

router.get("/stats/overview", requireAdmin, async (req, res) => {
  const start = new Date(str(req.query.startAt));
  const end = new Date(str(req.query.endAt));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return fail(res, "统计时间范围不正确");
  }
  if (end.getTime() - start.getTime() > 366 * 86400000) return fail(res, "统计范围不能超过 366 天");
  ok(res, await customOverview(start, end));
});

router.get("/members", requireAdmin, async (req, res) => {
  const keyword = str(req.query.keyword).trim();
  const page = Math.max(1, num(req.query.page, 1));
  const pageSize = Math.min(50, Math.max(1, num(req.query.pageSize, 20)));
  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (keyword) {
    where.OR = [
      { nickname: { contains: keyword } },
      { phone: { contains: keyword } },
    ];
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: { items: true, refunds: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const paidStatuses = new Set(["PAID", "MAKING", "READY", "COMPLETED", "REFUNDED"]);
  const list = users.map((user) => {
    const paidOrders = user.orders.filter((order) => paidStatuses.has(order.status));
    const totalSpent = paidOrders.reduce(
      (sum, order) => sum + (order.status === "REFUNDED" ? 0 : Number(order.totalAmount)),
      0
    );
    const refundCount = user.orders.reduce(
      (sum, order) => sum + order.refunds.filter((refund) => refund.status === "SUCCESS").length,
      0
    );
    const phone = user.phone
      ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`
      : null;
    return {
      id: user.id,
      nickname: user.nickname || `顾客 ${user.id}`,
      phone,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      totalSpent: Math.round(totalSpent * 100) / 100,
      orderCount: paidOrders.length,
      avgTicket: paidOrders.length ? Math.round((totalSpent / paidOrders.length) * 100) / 100 : 0,
      refundCount,
      lastOrderAt: paidOrders[0]?.createdAt ?? null,
      recentOrders: paidOrders.slice(0, 5).map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        createdAt: order.createdAt,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        items: order.items.map((item) => ({ productName: item.productName, quantity: item.quantity })),
      })),
    };
  });
  ok(res, { list, total, page, pageSize });
});

router.get("/promotions", requireAdmin, async (_req, res) => {
  const rows = await prisma.promotion.findMany({ orderBy: { createdAt: "desc" } });
  ok(res, rows.map((row) => ({ ...row, config: parseJson(row.config, {}) })));
});

function promotionData(body: any) {
  const name = str(body?.name).trim();
  const type = str(body?.type);
  const allowed = ["FULL_REDUCTION", "PERCENT", "NEW_CUSTOMER", "MEMBER_DAY"];
  if (!name || !allowed.includes(type)) throw new Error("活动名称或类型不正确");
  const config = body?.config && typeof body.config === "object" ? body.config : {};
  if (type === "FULL_REDUCTION") {
    if (num(config.threshold) <= 0 || num(config.reduction) <= 0 || num(config.reduction) >= num(config.threshold)) {
      throw new Error("满减门槛与优惠金额不正确");
    }
  } else if (type === "NEW_CUSTOMER") {
    if (num(config.reduction) <= 0) throw new Error("新客优惠金额必须大于 0");
  } else {
    const rate = Number(config.rate);
    if (!(rate > 0 && rate < 1)) throw new Error("折扣比例必须在 0–1 之间");
    if (type === "MEMBER_DAY" && (!Array.isArray(config.weekdays) || !config.weekdays.length)) {
      throw new Error("请选择会员日");
    }
  }
  const startsAt = body.startsAt ? new Date(str(body.startsAt)) : null;
  const endsAt = body.endsAt ? new Date(str(body.endsAt)) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    throw new Error("活动时间格式不正确");
  }
  if (startsAt && endsAt && startsAt >= endsAt) throw new Error("结束时间必须晚于开始时间");
  return { name, type, config: stringifyJson(config), startsAt, endsAt, isActive: body.isActive !== false };
}

router.post("/promotions", requireAdmin, requireManager, async (req, res) => {
  try {
    const promotion = await prisma.promotion.create({ data: promotionData(req.body) });
    await logAudit((req as any).admin.id, "PROMOTION_CREATE", "Promotion", promotion.id, promotion.name);
    ok(res, { ...promotion, config: parseJson(promotion.config, {}) }, "营销活动已创建");
  } catch (error: any) {
    fail(res, error?.message || "创建失败");
  }
});

router.put("/promotions/:id", requireAdmin, requireManager, async (req, res) => {
  try {
    const promotion = await prisma.promotion.update({ where: { id: num(req.params.id) }, data: promotionData(req.body) });
    await logAudit((req as any).admin.id, "PROMOTION_UPDATE", "Promotion", promotion.id, promotion.name);
    ok(res, { ...promotion, config: parseJson(promotion.config, {}) }, "营销活动已更新");
  } catch (error: any) {
    fail(res, error?.message || "更新失败");
  }
});

router.delete("/promotions/:id", requireAdmin, requireManager, async (req, res) => {
  const id = num(req.params.id);
  await prisma.promotion.delete({ where: { id } });
  await logAudit((req as any).admin.id, "PROMOTION_DELETE", "Promotion", id);
  ok(res, null, "营销活动已删除");
});

router.get("/orders", requireAdmin, async (req, res) => {
  const status = str(req.query.status);
  const keyword = str(req.query.keyword).trim();
  const orderType = str(req.query.orderType);
  const tableId = req.query.tableId ? num(req.query.tableId) : undefined;
  const startAt = req.query.startAt ? new Date(str(req.query.startAt)) : undefined;
  const endAt = req.query.endAt ? new Date(str(req.query.endAt)) : undefined;
  const page = Math.max(1, num(req.query.page, 1));
  const pageSize = Math.min(50, Math.max(1, num(req.query.pageSize, 20)));
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (orderType === "DINE_IN" || orderType === "TAKEOUT") where.orderType = orderType;
  if (tableId) where.tableId = tableId;
  if (keyword) {
    where.OR = [
      { orderNo: { contains: keyword } },
      { pickupNo: { contains: keyword } },
      { phone: { endsWith: keyword } },
    ];
  }
  if (
    (startAt && !Number.isNaN(startAt.getTime())) ||
    (endAt && !Number.isNaN(endAt.getTime()))
  ) {
    where.createdAt = {
      ...(startAt && !Number.isNaN(startAt.getTime()) ? { gte: startAt } : {}),
      ...(endAt && !Number.isNaN(endAt.getTime()) ? { lte: endAt } : {}),
    };
  }
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
  const id = num(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      table: true,
      payments: true,
      statusLogs: { orderBy: { createdAt: "asc" } },
      refunds: { include: { admin: { select: { username: true } } } },
    },
  });
  if (!order) return fail(res, "订单不存在");
  const auditLogs = await prisma.auditLog.findMany({
    where: { targetType: "Order", targetId: id },
    orderBy: { createdAt: "asc" },
    include: { admin: { select: { username: true } } },
  });
  ok(res, { ...serializeOrder(order), auditLogs });
});

router.get("/alerts", requireAdmin, async (_req, res) => {
  const overdueBefore = new Date(Date.now() - 20 * 60 * 1000);
  const [failedRefunds, overduePaid, overdueMaking, paymentFailures] = await Promise.all([
    prisma.refund.count({ where: { status: "FAILED" } }),
    prisma.order.count({ where: { status: "PAID", paidAt: { lte: overdueBefore } } }),
    prisma.order.count({ where: { status: "MAKING", updatedAt: { lte: overdueBefore } } }),
    prisma.payment.count({ where: { status: { not: "SUCCESS" }, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  ok(res, { failedRefunds, overduePaid, overdueMaking, paymentFailures });
});

router.patch("/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const order = await transitionOrder(num(req.params.id), str(req.body?.status) as any);
    await logAudit((req as any).admin.id, "ORDER_STATUS", "Order", order?.id, str(req.body?.status));
    ok(res, serializeOrder(order), "状态已更新");
  } catch (e: any) {
    fail(res, e?.message || "状态更新失败");
  }
});

router.post("/orders/:id/print", requireAdmin, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: num(req.params.id) },
    include: { items: true, table: true },
  });
  if (!order) return fail(res, "订单不存在");
  try {
    await printOrder(order);
    await logAudit((req as any).admin.id, "ORDER_REPRINT", "Order", order.id, order.orderNo);
    ok(res, null, "打印任务已提交");
  } catch (e: any) {
    fail(res, e?.message || "打印任务提交失败");
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

router.put("/refunds/:id", requireAdmin, requireManager, async (req, res) => {
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
    await logAudit((req as any).admin.id, "REFUND_HANDLE", "Refund", num(req.params.id), action);
    ok(res, refund, action === "APPROVED" ? "退款已提交原路退回" : "已拒绝退款");
  } catch (e: any) {
    fail(res, e?.message || "退款处理失败");
  }
});

router.post("/refunds/:id/sync", requireAdmin, requireManager, async (req, res) => {
  try {
    const refundId = num(req.params.id);
    await syncWechatRefund(refundId);
    await logAudit((req as any).admin.id, "REFUND_SYNC", "Refund", refundId);
    const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { order: true } });
    ok(res, refund, "退款状态已同步");
  } catch (e: any) {
    fail(res, e?.message || "退款状态同步失败");
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

router.post("/categories", requireAdmin, requireManager, async (req, res) => {
  const name = str(req.body?.name).trim();
  if (!name) return fail(res, "分类名称不能为空");
  const category = await prisma.category.create({
    data: { name, sortOrder: num(req.body?.sortOrder) },
  });
  ok(res, category, "分类已创建");
});

router.post("/categories/reorder", requireAdmin, requireManager, async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((value: unknown) => num(value)).filter((id: number) => id > 0) : [];
  if (!ids.length) return fail(res, "排序数据不能为空");
  await prisma.$transaction(ids.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index } })));
  await logAudit((req as any).admin.id, "CATEGORY_REORDER", "Category", undefined, `count=${ids.length}`);
  ok(res, { count: ids.length }, "分类排序已保存");
});

router.put("/categories/:id", requireAdmin, requireManager, async (req, res) => {
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

router.delete("/categories/:id", requireAdmin, requireManager, async (req, res) => {
  const count = await prisma.product.count({ where: { categoryId: num(req.params.id) } });
  if (count > 0) return fail(res, "该分类下仍有商品，无法删除");
  await prisma.category.delete({ where: { id: num(req.params.id) } });
  ok(res, null, "分类已删除");
});

router.get("/products", requireAdmin, async (req, res) => {
  const keyword = str(req.query.keyword).trim();
  const categoryId = req.query.categoryId ? num(req.query.categoryId) : undefined;
  const status = str(req.query.status);
  const where: Record<string, unknown> = {};
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { nameEn: { contains: keyword } },
      { flavorNotes: { contains: keyword } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status === "on") {
    where.isActive = true;
    where.isSoldOut = false;
  } else if (status === "soldout") {
    where.isSoldOut = true;
  } else if (status === "off") {
    where.isActive = false;
  }
  ok(
    res,
    (await prisma.product.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: { category: true, ...specInclude },
    })).map(serializeProduct)
  );
});

router.post("/products", requireAdmin, requireManager, async (req, res) => {
  const body = req.body ?? {};
  if (!str(body.name).trim()) return fail(res, "商品名称不能为空");
  const soldOutUntil = body.isSoldOut === true && body.soldOutUntil ? new Date(str(body.soldOutUntil)) : null;
  if (soldOutUntil && Number.isNaN(soldOutUntil.getTime())) return fail(res, "恢复时间格式不正确");
  const specGroupIds = Array.isArray(body.specGroupIds) ? body.specGroupIds : [];
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
      isSignature: body.isSignature === true,
      isHot: body.isHot === true,
      sortOrder: num(body.sortOrder),
      isSoldOut: body.isSoldOut === true,
      soldOutUntil,
      isActive: body.isActive !== false,
      specGroups: {
        create: specGroupIds.map((s: any, idx: number) => ({
          specGroupId: num(s?.specGroupId),
          required: s?.required !== false,
          sortOrder: idx,
        })),
      },
    },
    include: specInclude,
  });
  await logAudit((req as any).admin.id, "PRODUCT_CREATE", "Product", product.id, product.name);
  ok(res, serializeProduct(product), "商品已创建");
});

router.patch("/products/batch", requireAdmin, requireManager, async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids)
    ? [...new Set<number>(req.body.ids.map((value: unknown) => num(value)).filter((id: number) => id > 0))]
    : [];
  if (!ids.length) return fail(res, "请选择商品");
  const data: Record<string, unknown> = {};
  if (typeof req.body?.isActive === "boolean") data.isActive = req.body.isActive;
  if (typeof req.body?.isSoldOut === "boolean") data.isSoldOut = req.body.isSoldOut;
  if (req.body?.categoryId !== undefined) data.categoryId = num(req.body.categoryId);
  if (!Object.keys(data).length) return fail(res, "没有可更新的字段");
  const result = await prisma.product.updateMany({ where: { id: { in: ids } }, data });
  await logAudit((req as any).admin.id, "PRODUCT_BATCH_UPDATE", "Product", undefined, `count=${result.count}`);
  ok(res, { count: result.count }, "商品已批量更新");
});

router.post("/products/reorder", requireAdmin, requireManager, async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((value: unknown) => num(value)).filter((id: number) => id > 0) : [];
  if (!ids.length) return fail(res, "排序数据不能为空");
  await prisma.$transaction(ids.map((id, index) => prisma.product.update({ where: { id }, data: { sortOrder: index } })));
  await logAudit((req as any).admin.id, "PRODUCT_REORDER", "Product", undefined, `count=${ids.length}`);
  ok(res, { count: ids.length }, "商品排序已保存");
});

router.put("/products/:id", requireAdmin, requireManager, async (req, res) => {
  const body = req.body ?? {};
  const id = num(req.params.id);
  const soldOutUntil = body.soldOutUntil ? new Date(str(body.soldOutUntil)) : null;
  if (body.soldOutUntil && Number.isNaN(soldOutUntil?.getTime())) return fail(res, "恢复时间格式不正确");
  const specGroupIds = Array.isArray(body.specGroupIds) ? body.specGroupIds : undefined;
  const product = await prisma.$transaction(async (tx) => {
    if (specGroupIds) {
      await tx.productSpecGroup.deleteMany({ where: { productId: id } });
    }
    return tx.product.update({
      where: { id },
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
        isSignature: typeof body.isSignature === "boolean" ? body.isSignature : undefined,
        isHot: typeof body.isHot === "boolean" ? body.isHot : undefined,
        sortOrder: body.sortOrder !== undefined ? num(body.sortOrder) : undefined,
        isSoldOut: typeof body.isSoldOut === "boolean" ? body.isSoldOut : undefined,
        soldOutUntil:
          body.soldOutUntil !== undefined
            ? body.isSoldOut === false || !body.soldOutUntil
              ? null
              : soldOutUntil
            : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        specGroups: specGroupIds
          ? {
              create: specGroupIds.map((s: any, idx: number) => ({
                specGroupId: num(s?.specGroupId),
                required: s?.required !== false,
                sortOrder: idx,
              })),
            }
          : undefined,
      },
      include: specInclude,
    });
  });
  await logAudit((req as any).admin.id, "PRODUCT_UPDATE", "Product", id, product?.name);
  ok(res, serializeProduct(product), "商品已更新");
});

router.patch("/products/:id/sold-out", requireAdmin, async (req, res) => {
  const soldOut = req.body?.soldOut === true;
  const until = soldOut && req.body?.soldOutUntil ? new Date(str(req.body.soldOutUntil)) : null;
  if (until && Number.isNaN(until.getTime())) return fail(res, "恢复时间格式不正确");
  const product = await prisma.product.update({
    where: { id: num(req.params.id) },
    data: { isSoldOut: soldOut, soldOutUntil: until },
  });
  await logAudit((req as any).admin.id, "PRODUCT_SOLDOUT", "Product", product.id, String(product.isSoldOut));
  ok(res, serializeProduct(product), product.isSoldOut ? "已标记售罄" : "已恢复在售");
});

router.delete("/products/:id", requireAdmin, requireManager, async (req, res) => {
  await prisma.product.delete({ where: { id: num(req.params.id) } });
  await logAudit((req as any).admin.id, "PRODUCT_DELETE", "Product", num(req.params.id));
  ok(res, null, "商品已删除");
});

router.get("/spec-groups", requireAdmin, async (_req, res) => {
  const groups = await prisma.specGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });
  ok(res, groups);
});

router.post("/spec-groups", requireAdmin, requireManager, async (req, res) => {
  const body = req.body ?? {};
  const name = str(body.name).trim();
  if (!name) return fail(res, "规格组名称不能为空");
  const options = Array.isArray(body.options)
    ? body.options
        .map((o: any, i: number) => ({
          label: str(o?.label).trim(),
          extraPrice: num(o?.extraPrice),
          isDefault: o?.isDefault === true,
          sortOrder: i,
        }))
        .filter((o: any) => o.label)
    : [];
  if (!options.length) return fail(res, "至少需要一个规格选项");
  const group = await prisma.specGroup.create({
    data: {
      name,
      type: body.type === "MULTI" ? "MULTI" : "SINGLE",
      sortOrder: num(body.sortOrder),
      options: { create: options },
    },
    include: { options: true },
  });
  await logAudit((req as any).admin.id, "SPECGROUP_CREATE", "SpecGroup", group.id, name);
  ok(res, group, "规格组已创建");
});

router.put("/spec-groups/:id", requireAdmin, requireManager, async (req, res) => {
  const id = num(req.params.id);
  const body = req.body ?? {};
  const options = Array.isArray(body.options)
    ? body.options
        .map((o: any, i: number) => ({
          label: str(o?.label).trim(),
          extraPrice: num(o?.extraPrice),
          isDefault: o?.isDefault === true,
          sortOrder: i,
        }))
        .filter((o: any) => o.label)
    : undefined;
  if (options !== undefined && !options.length) {
    return fail(res, "至少需要一个规格选项");
  }
  const group = await prisma.$transaction(async (tx) => {
    if (options) {
      await tx.specOption.deleteMany({ where: { groupId: id } });
    }
    return tx.specGroup.update({
      where: { id },
      data: {
        name: body.name !== undefined ? str(body.name).trim() : undefined,
        type: body.type !== undefined ? (body.type === "MULTI" ? "MULTI" : "SINGLE") : undefined,
        sortOrder: body.sortOrder !== undefined ? num(body.sortOrder) : undefined,
        options: options ? { create: options } : undefined,
      },
      include: { options: true },
    });
  });
  await logAudit((req as any).admin.id, "SPECGROUP_UPDATE", "SpecGroup", id);
  ok(res, group, "规格组已更新");
});

router.delete("/spec-groups/:id", requireAdmin, requireManager, async (req, res) => {
  const id = num(req.params.id);
  const linked = await prisma.productSpecGroup.count({ where: { specGroupId: id } });
  if (linked > 0) return fail(res, "该规格组已被商品使用，无法删除");
  await prisma.specOption.deleteMany({ where: { groupId: id } });
  await prisma.specGroup.delete({ where: { id } });
  await logAudit((req as any).admin.id, "SPECGROUP_DELETE", "SpecGroup", id);
  ok(res, null, "规格组已删除");
});

router.get("/tables", requireAdmin, async (_req, res) => {
  ok(res, await prisma.tableInfo.findMany({ orderBy: { tableNo: "asc" } }));
});

router.post("/tables", requireAdmin, requireManager, async (req, res) => {
  const tableNo = str(req.body?.tableNo).trim();
  if (!tableNo) return fail(res, "桌号不能为空");
  const table = await prisma.tableInfo.create({ data: { tableNo } });
  ok(res, table, "桌台已创建");
});

router.put("/tables/:id", requireAdmin, requireManager, async (req, res) => {
  const table = await prisma.tableInfo.update({
    where: { id: num(req.params.id) },
    data: {
      tableNo: req.body?.tableNo !== undefined ? str(req.body.tableNo).trim() : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
    },
  });
  ok(res, table, "桌台已更新");
});

router.delete("/tables/:id", requireAdmin, requireManager, async (req, res) => {
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

router.post("/tables/:id/miniprogram-code", requireAdmin, async (req, res) => {
  const table = await prisma.tableInfo.findUnique({ where: { id: num(req.params.id) } });
  if (!table) return fail(res, "桌台不存在");
  const image = await createUnlimitedMiniProgramCode(`table_${table.id}`);
  const dir = path.resolve(process.cwd(), "uploads/miniprogram-codes");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `table-${table.id}.png`);
  fs.writeFileSync(file, image);
  const qrUrl = `/uploads/miniprogram-codes/table-${table.id}.png`;
  await prisma.tableInfo.update({ where: { id: table.id }, data: { qrCodeUrl: qrUrl } });
  ok(res, { qrUrl, scene: `table_${table.id}`, tableNo: table.tableNo }, "小程序桌码已生成");
});

router.post("/takeout-miniprogram-code", requireAdmin, async (_req, res) => {
  const image = await createUnlimitedMiniProgramCode("takeout");
  const dir = path.resolve(process.cwd(), "uploads/miniprogram-codes");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "takeout.png");
  fs.writeFileSync(file, image);
  ok(res, { qrUrl: "/uploads/miniprogram-codes/takeout.png", scene: "takeout" }, "外带小程序码已生成");
});

router.post("/tables/miniprogram-codes", requireAdmin, requireManager, async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids)
    ? [...new Set<number>(req.body.ids.map((value: unknown) => num(value)).filter((id: number) => id > 0))]
    : [];
  if (!ids.length || ids.length > 50) return fail(res, "请选择 1–50 个桌台");
  const tables = await prisma.tableInfo.findMany({ where: { id: { in: ids } } });
  const dir = path.resolve(process.cwd(), "uploads/miniprogram-codes");
  fs.mkdirSync(dir, { recursive: true });
  const results: Array<{ id: number; tableNo: string; qrUrl?: string; error?: string }> = [];
  for (const table of tables) {
    try {
      const image = await createUnlimitedMiniProgramCode(`table_${table.id}`);
      const qrUrl = `/uploads/miniprogram-codes/table-${table.id}.png`;
      fs.writeFileSync(path.join(dir, `table-${table.id}.png`), image);
      await prisma.tableInfo.update({ where: { id: table.id }, data: { qrCodeUrl: qrUrl } });
      results.push({ id: table.id, tableNo: table.tableNo, qrUrl });
    } catch (error: any) {
      results.push({ id: table.id, tableNo: table.tableNo, error: error?.message || "生成失败" });
    }
  }
  await logAudit((req as any).admin.id, "TABLE_CODES_BATCH", "TableInfo", undefined, `count=${tables.length}`);
  ok(res, results, "批量生成完成");
});

router.get("/settings", requireAdmin, requireManager, async (_req, res) => {
  const setting = await prisma.shopSetting.findFirst();
  ok(
    res,
    setting ? { ...setting, printerConfig: parseJson(setting.printerConfig, null) } : null
  );
});

router.put("/settings", requireAdmin, requireManager, async (req, res) => {
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
  await logAudit((req as any).admin.id, "SETTINGS_UPDATE", "ShopSetting", setting?.id);
});

router.post("/printer/test", requireAdmin, async (_req, res) => {
  console.log("[printer] 测试打印请求已接收");
  ok(res, { sent: true }, "测试打印已发送");
});

router.post("/products/:id/image", requireAdmin, requireManager, upload.single("file"), async (req, res) => {
  if (!req.file) return fail(res, "请选择要上传的图片");
  const imageUrl = `/uploads/products/${req.file.filename}`;
  const product = await prisma.product.update({
    where: { id: num(req.params.id) },
    data: { imageUrl },
  });
  ok(res, serializeProduct(product), "图片已上传");
});

router.put("/password", requireAdmin, async (req, res) => {
  const { oldPassword, newPassword } = req.body ?? {};
  if (!str(oldPassword) || !str(newPassword)) {
    return fail(res, "请填写旧密码与新密码");
  }
  if (str(newPassword).length < 8) {
    return fail(res, "新密码至少 8 位");
  }
  const admin = await prisma.admin.findUnique({ where: { id: (req as any).admin.id } });
  if (!admin || !bcrypt.compareSync(str(oldPassword), admin.passwordHash)) {
    return fail(res, "旧密码不正确");
  }
  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data: {
      passwordHash: bcrypt.hashSync(str(newPassword), 10),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
  ok(
    res,
    {
      username: updated.username,
      mustChangePassword: false,
      token: signAdmin({ id: updated.id, role: updated.role, ver: updated.tokenVersion }),
    },
    "密码已修改"
  );
});

router.post("/takeout-qrcode", requireAdmin, async (_req, res) => {
  const webBase = process.env.WEB_BASE_URL || "http://localhost";
  const url = `${webBase}/#/pages/index/index`;
  const dir = path.resolve(process.cwd(), "uploads/qr");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "takeout.png");
  await QRCode.toFile(file, url, { width: 600, margin: 1 });
  ok(res, { qrUrl: "/uploads/qr/takeout.png", url }, "外带码已生成");
});

export default router;
