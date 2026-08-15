import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { num, str } from "../lib/validate.js";
import { fail, ok } from "../lib/response.js";
import { signUser } from "../lib/jwt.js";
import { serializeOrder, serializeProduct } from "../lib/json.js";
import { optionalUser } from "../middleware/auth.js";
import { createOrder, mockPay, requestRefund, wechatPay } from "../services/order.js";
import { handlePaymentCallback } from "../services/payment.js";

const router = Router();

router.get("/health", (_req, res) => ok(res, { ok: true }));

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
  if (!product) return fail(res, "商品不存在或已下架");
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
  const deviceId = str(req.body?.deviceId, "").trim();
  if (!deviceId) return fail(res, "缺少设备标识");
  const existing = await prisma.user.findFirst({ where: { openid: `guest:${deviceId}` } });
  const user =
    existing ??
    (await prisma.user.create({
      data: { openid: `guest:${deviceId}`, nickname: "咖啡客人" },
    }));
  ok(res, { userId: user.id, token: signUser(user.id) });
});

router.post("/orders", optionalUser, async (req, res) => {
  const body = req.body ?? {};
  const userId = (req as any).userId;
  try {
    const order = await createOrder({
      userId,
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

router.post("/orders/:id/mock-pay", optionalUser, async (req, res) => {
  try {
    const order = await mockPay(num(req.params.id), (req as any).userId);
    ok(res, serializeOrder(order), "支付成功");
  } catch (e: any) {
    fail(res, e?.message || "支付失败");
  }
});

router.post("/orders/:id/pay", optionalUser, async (req, res) => {
  try {
    const order = await wechatPay(num(req.params.id));
    ok(res, serializeOrder(order), "支付成功");
  } catch (e: any) {
    fail(res, e?.message || "支付失败");
  }
});

// 微信支付结果回调（公网可访问，验签 fail-closed）
router.post("/payment/callback", async (req, res) => {
  try {
    const rawBody: Buffer =
      (req as any).rawBody || Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
    const result = await handlePaymentCallback(rawBody, req.headers as Record<string, string>);
    res.json(result);
  } catch (e: any) {
    console.error("[payment] callback error:", e?.message);
    res.status(400).json({ code: "FAIL", message: e?.message || "回调处理失败" });
  }
});

router.get("/orders/my", optionalUser, async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return ok(res, []);
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true, table: true },
  });
  ok(res, orders.map(serializeOrder));
});

router.get("/orders/:id", optionalUser, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: num(req.params.id) },
    include: { items: true, table: true, payments: true, refunds: true },
  });
  if (!order) return fail(res, "订单不存在");
  const userId = (req as any).userId;
  if (userId && order.userId && order.userId !== userId) return fail(res, "无权查看该订单");
  ok(res, serializeOrder(order));
});

router.post("/orders/:id/refund", optionalUser, async (req, res) => {
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
