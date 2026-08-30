import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { num, str } from "../lib/validate.js";
import { fail, ok } from "../lib/response.js";
import { signUser } from "../lib/jwt.js";
import { serializeOrder, serializeProduct } from "../lib/json.js";
import { requireUser } from "../middleware/auth.js";
import {
  cancelUnpaidOrder,
  createOrder,
  mockPay,
  requestRefund,
  wechatPay,
} from "../services/order.js";
import {
  confirmWechatPayment,
  handlePaymentCallback,
  handleRefundCallback,
} from "../services/payment.js";
import { memberProfile } from "../services/member.js";
import { isConsoleSms, isSmsEnabled, sendSmsCode } from "../services/sms.js";
import { createJsapiPayment, jscode2session, queryJsapiPayment, wxMpConfigured, wxPayConfigured } from "../services/wechat.js";
import { orderLimiter, paymentLimiter, smsLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/health", (_req, res) => ok(res, { ok: true }));

router.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { ready: true });
  } catch {
    res.status(503).json({ code: 503, message: "服务暂未就绪" });
  }
});

router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
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
        },
      },
    },
  });
  ok(
    res,
    categories.map((c) => ({ ...c, products: c.products.map(serializeProduct) }))
  );
});

router.get("/products/:id", async (req, res) => {
  const id = num(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "商品参数无效", 400, 400);
  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: {
      category: true,
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
    },
  });
  if (!product) return fail(res, "商品不存在或已下架", 404, 404);
  ok(res, serializeProduct(product));
});

router.get("/tables", async (_req, res) => {
  const tables = await prisma.tableInfo.findMany({
    where: { isActive: true },
    orderBy: { tableNo: "asc" },
  });
  ok(res, tables);
});

router.get("/shop", async (_req, res) => {
  const setting = await prisma.shopSetting.findFirst();
  ok(res, setting);
});

router.post("/auth/guest", async (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.GUEST_LOGIN_ENABLED === "false") {
    return fail(res, "游客登录未启用", 403, 403);
  }
  const deviceId = str(req.body?.deviceId, "").trim();
  if (!deviceId) return fail(res, "缺少设备标识");
  const existing = await prisma.user.findFirst({ where: { openid: `guest:${deviceId}`, status: "ACTIVE" } });
  const user =
    existing ??
    (await prisma.user.create({
      data: { openid: `guest:${deviceId}`, nickname: "咖啡客人" },
    }));
  ok(res, { userId: user.id, token: signUser(user.id, user.tokenVersion) });
});

// 微信小程序登录：code 换取 openid 并建立/绑定用户
router.post("/auth/wx-login", async (req, res) => {
  const code = str(req.body?.code, "").trim();
  if (!code) return fail(res, "缺少微信登录 code");
  if (!wxMpConfigured()) return fail(res, "微信小程序登录未配置（WECHAT_MP_APPID/SECRET）");
  try {
    const session = await jscode2session(code);
    let user = await prisma.user.findFirst({ where: { wxOpenid: session.openid, status: "ACTIVE" } });
    if (!user) {
      user = await prisma.user.create({
        data: { wxOpenid: session.openid, nickname: "微信用户" },
      });
    }
    ok(res, {
      userId: user.id,
      token: signUser(user.id, user.tokenVersion),
      user: { id: user.id, phone: user.phone, phoneVerified: user.phoneVerified },
    });
  } catch (e: any) {
    fail(res, e?.message || "微信登录失败");
  }
});

router.post("/auth/send-code", smsLimiter(), async (req, res) => {
  if (!isSmsEnabled()) return fail(res, "手机号绑定服务暂未开放", 503, 503);
  const phone = str(req.body?.phone, "").trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail(res, "手机号格式不正确");
  const last = await prisma.smsCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < 60_000) {
    return fail(res, "发送过于频繁，请 1 分钟后再试");
  }
  if (process.env.NODE_ENV === "production" && isConsoleSms()) {
    return fail(res, "手机号绑定服务未正确配置", 503, 503);
  }
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "coffee-os-sms-dev")
    .update(code)
    .digest("hex");
  await prisma.smsCode.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
  });
  await prisma.smsCode.create({
    data: { phone, code: codeHash, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });
  await sendSmsCode(phone, code);
  ok(res, { devCode: isConsoleSms() ? code : undefined }, "验证码已发送");
});

router.post("/user/phone", requireUser, async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return fail(res, "请先登录");
  const phone = str(req.body?.phone, "").trim();
  const code = str(req.body?.code, "").trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail(res, "手机号格式不正确");
  if (!/^\d{6}$/.test(code)) return fail(res, "验证码格式不正确");
  const record = await prisma.smsCode.findFirst({
    where: { phone, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const codeHash = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "coffee-os-sms-dev")
    .update(code)
    .digest("hex");
  if (!record || record.expiresAt < new Date() || record.attempts >= 5) {
    return fail(res, "验证码无效或已过期");
  }
  if (record.code !== codeHash) {
    await prisma.smsCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return fail(res, "验证码无效或已过期");
  }
  const dup = await prisma.user.findFirst({ where: { phone, id: { not: userId } } });
  if (dup) return fail(res, "该手机号已绑定其他账号");
  await prisma.$transaction([
    prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { phone, phoneVerified: true } }),
  ]);
  ok(res, await memberProfile(userId), "绑定成功");
});

// 保存用户订阅消息授权（出餐通知模板）
router.post("/user/subscribe", requireUser, async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return fail(res, "请先登录");
  const templateId = str(req.body?.templateId, "").trim();
  if (!templateId) return fail(res, "缺少模板ID");
  const configuredTemplate = String(process.env.WECHAT_SUBSCRIBE_TEMPLATE_READY || "");
  if (
    process.env.NODE_ENV === "production" &&
    (!configuredTemplate || templateId !== configuredTemplate)
  ) {
    return fail(res, "订阅模板不可用");
  }
  const status = str(req.body?.status, "").trim();
  if (!["ACCEPTED", "REJECTED", "BANNED"].includes(status)) {
    return fail(res, "订阅授权状态无效");
  }
  await prisma.userSubscribe.upsert({
    where: { userId_templateId: { userId, templateId } },
    update: { status },
    create: { userId, templateId, status },
  });
  ok(res, null, "订阅已保存");
});

router.get("/user/profile", requireUser, async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return fail(res, "请先登录");
  ok(res, await memberProfile(userId));
});

router.post("/user/deactivate", requireUser, async (req, res) => {
  const userId = (req as any).userId as number;
  const phrase = str(req.body?.confirm).trim();
  if (phrase !== "确认注销") return fail(res, "请输入“确认注销”完成确认");
  const [openOrders, member] = await Promise.all([
    prisma.order.count({
      where: { userId, status: { in: ["UNPAID", "PAID", "MAKING", "READY", "REFUNDING"] } },
    }),
    prisma.memberAccount.findUnique({ where: { userId } }),
  ]);
  if (openOrders > 0) return fail(res, "存在进行中订单或退款，请处理完成后再注销");
  if (member && Number(member.balance) !== 0) return fail(res, "账户仍有余额，请先联系客服处理");
  await prisma.$transaction([
    prisma.userSubscribe.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        openid: null,
        wxOpenid: null,
        phone: null,
        phoneVerified: false,
        nickname: "已注销用户",
        avatar: null,
        status: "DELETED",
        tokenVersion: { increment: 1 },
        deletedAt: new Date(),
      },
    }),
  ]);
  ok(res, null, "账号已注销");
});

router.post("/orders", orderLimiter(), requireUser, async (req, res) => {
  const body = req.body ?? {};
  const userId = (req as any).userId;
  try {
    const order = await createOrder({
      userId,
      clientRequestId: str(body.clientRequestId),
      tableId: body.tableId ? num(body.tableId) : undefined,
      orderType: body.orderType === "TAKEOUT" ? "TAKEOUT" : "DINE_IN",
      items: Array.isArray(body.items) ? body.items : [],
      remark: str(body.remark),
      phone: str(body.phone),
    });
    ok(res, serializeOrder(order), "订单创建成功");
  } catch (e: any) {
    fail(res, e?.message || "创建订单失败");
  }
});

router.post("/orders/:id/mock-pay", paymentLimiter(), requireUser, async (req, res) => {
  try {
    const order = await mockPay(num(req.params.id), (req as any).userId);
    ok(res, serializeOrder(order), "支付成功");
  } catch (e: any) {
    fail(res, e?.message || "支付失败");
  }
});

router.post("/orders/:id/pay", paymentLimiter(), requireUser, async (req, res) => {
  try {
    const platform = str(req.headers["x-platform"] || "");
    if (platform === "mp-weixin") {
      // 小程序端：返回 wx.requestPayment 参数（未配置时 fail-closed）
      const order = await prisma.order.findUnique({ where: { id: num(req.params.id) } });
      if (!order) return fail(res, "订单不存在");
      if (!order.userId || order.userId !== (req as any).userId) return fail(res, "无权操作该订单", 403, 403);
      if (order.status !== "UNPAID") return fail(res, "订单状态不允许支付");
      if (!wxPayConfigured()) return fail(res, "微信支付未配置（WECHAT_MCH_ID/SERIAL/私钥/APIv3密钥）");
      const user = order.userId
        ? await prisma.user.findUnique({ where: { id: order.userId } })
        : null;
      if (!user?.wxOpenid) return fail(res, "缺少微信 openid，请先微信登录");
      const payParams = await createJsapiPayment(order, user.wxOpenid);
      return ok(res, { payParams });
    }
    // H5 等非小程序端：暂用模拟支付
    const order = await wechatPay(num(req.params.id), (req as any).userId);
    ok(res, serializeOrder(order), "支付成功");
  } catch (e: any) {
    fail(res, e?.message || "支付失败");
  }
});

router.post("/orders/:id/payment-status", paymentLimiter(), requireUser, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: num(req.params.id) } });
    if (!order) return fail(res, "订单不存在");
    if (!order.userId || order.userId !== (req as any).userId) return fail(res, "无权操作该订单", 403, 403);
    if (["PAID", "MAKING", "READY", "COMPLETED"].includes(order.status)) {
      return ok(res, serializeOrder(order));
    }
    if (order.status !== "UNPAID" && order.status !== "CANCELLED") return ok(res, serializeOrder(order));
    if (!wxPayConfigured()) return ok(res, serializeOrder(order));
    const event = await queryJsapiPayment(order.orderNo);
    if (event.trade_state === "SUCCESS") await confirmWechatPayment(event);
    const latest = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, table: true, payments: true, refunds: true },
    });
    ok(res, serializeOrder(latest));
  } catch (e: any) {
    fail(res, e?.message || "支付状态查询失败");
  }
});

router.post("/orders/:id/cancel", paymentLimiter(), requireUser, async (req, res) => {
  try {
    const order = await cancelUnpaidOrder(num(req.params.id), (req as any).userId);
    ok(res, serializeOrder(order), "订单已取消");
  } catch (e: any) {
    fail(res, e?.message || "取消订单失败");
  }
});

// 微信支付结果回调（公网可访问，验签 fail-closed）
router.post("/payment/callback", async (req, res) => {
  try {
    const rawBody: Buffer =
      (req as any).rawBody || Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
    const result = await handlePaymentCallback(rawBody, req.headers as Record<string, string>);
    res.json(result);
  } catch {
    console.error("[payment] callback rejected");
    res.status(400).json({ code: "FAIL", message: "回调处理失败" });
  }
});

// 微信退款结果回调（公网可访问，验签和解密规则与支付回调一致）
router.post("/refund/callback", async (req, res) => {
  try {
    const rawBody: Buffer =
      (req as any).rawBody || Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
    const result = await handleRefundCallback(rawBody, req.headers as Record<string, string>);
    res.json(result);
  } catch {
    console.error("[refund] callback rejected");
    res.status(400).json({ code: "FAIL", message: "回调处理失败" });
  }
});

router.get("/orders/my", requireUser, async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return ok(res, []);
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true, table: true },
  });
  ok(res, orders.map(serializeOrder));
});

router.get("/orders/:id", requireUser, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: num(req.params.id) },
    include: { items: true, table: true, payments: true, refunds: true },
  });
  if (!order) return fail(res, "订单不存在");
  const userId = (req as any).userId;
  if (!order.userId || order.userId !== userId) return fail(res, "无权查看该订单", 403, 403);
  ok(res, serializeOrder(order));
});

router.post("/orders/:id/refund", requireUser, async (req, res) => {
  try {
    const order = await requestRefund(
      num(req.params.id),
      (req as any).userId,
      str(req.body?.reason)
    );
    ok(res, serializeOrder(order), "退款申请已提交");
  } catch (e: any) {
    fail(res, e?.message || "退款申请失败");
  }
});

export default router;
