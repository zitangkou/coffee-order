// Coffee OS 后端冒烟测试：需先启动后端（npm run dev）
// 用法：node scripts/smoke.mjs   （默认 http://localhost:3000/api）
const BASE = process.env.SMOKE_BASE || "http://localhost:3000/api";

let passed = 0;
let failed = 0;

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`${path} -> ${json.msg}`);
  return json.data;
}

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ✓ ${name}`);
    })
    .catch((e) => {
      failed += 1;
      console.log(`  ✗ ${name}: ${e.message}`);
    });
}

async function main() {
  console.log("[smoke] Coffee OS 后端冒烟测试");

  await check("健康检查", async () => {
    const data = await call("/health");
    if (!data.ok) throw new Error("health 未返回 ok");
  });

  await check("菜单与商品", async () => {
    const cats = await call("/categories");
    if (!cats.length || !cats[0].products?.length) throw new Error("无分类或商品");
    globalThis.firstProductId = cats[0].products[0].id;
  });

  await check("游客登录", async () => {
    const data = await call("/auth/guest", {
      method: "POST",
      body: { deviceId: `smoke-${Date.now()}` },
    });
    if (!data.token) throw new Error("未返回 token");
    globalThis.userToken = data.token;
  });

  await check("创建订单", async () => {
    const order = await call("/orders", {
      method: "POST",
      token: globalThis.userToken,
      body: {
        tableId: 1,
        orderType: "DINE_IN",
        remark: "冒烟测试",
        items: [{ productId: globalThis.firstProductId, quantity: 1, specs: {} }],
      },
    });
    if (!order.id || !order.pickupNo) throw new Error("订单字段缺失");
    globalThis.orderId = order.id;
  });

  await check("模拟支付", async () => {
    const order = await call(`/orders/${globalThis.orderId}/mock-pay`, {
      method: "POST",
      token: globalThis.userToken,
    });
    if (order.status !== "PAID") throw new Error(`状态=${order.status}`);
  });

  await check("商家登录", async () => {
    const data = await call("/admin/login", {
      method: "POST",
      body: { username: "admin", password: "admin123" },
    });
    if (!data.token) throw new Error("未返回 token");
    globalThis.adminToken = data.token;
  });

  await check("今日统计", async () => {
    const stats = await call("/admin/stats/today", { token: globalThis.adminToken });
    if (!stats.revenue || !stats.orderCount) throw new Error("统计为空");
  });

  await check("接单/出餐", async () => {
    let o = await call(`/admin/orders/${globalThis.orderId}/status`, {
      method: "PATCH",
      token: globalThis.adminToken,
      body: { status: "MAKING" },
    });
    if (o.status !== "MAKING") throw new Error(`状态=${o.status}`);
    o = await call(`/admin/orders/${globalThis.orderId}/status`, {
      method: "PATCH",
      token: globalThis.adminToken,
      body: { status: "READY" },
    });
    if (o.status !== "READY") throw new Error(`状态=${o.status}`);
  });

  await check("退款申请与审核", async () => {
    let o = await call(`/orders/${globalThis.orderId}/refund`, {
      method: "POST",
      token: globalThis.userToken,
      body: { reason: "冒烟测试退款" },
    });
    if (o.status !== "REFUNDING") throw new Error(`状态=${o.status}`);
    const refunds = await call("/admin/refunds", { token: globalThis.adminToken });
    const refund = refunds.find((r) => r.orderId === globalThis.orderId);
    if (!refund) throw new Error("未找到退款申请");
    const done = await call(`/admin/refunds/${refund.id}`, {
      method: "PUT",
      token: globalThis.adminToken,
      body: { action: "approved" },
    });
    if (done.order.status !== "REFUNDED") throw new Error(`退款后状态=${done.order.status}`);
  });

  await check("商品图片上传", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const fd = new FormData();
    fd.append("file", new Blob([png], { type: "image/png" }), "smoke.png");
    const res = await fetch(`${BASE}/admin/products/${globalThis.firstProductId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${globalThis.adminToken}` },
      body: fd,
    });
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.msg);
    if (!json.data.imageUrl) throw new Error("未返回 imageUrl");
  });

  await check("外带码生成", async () => {
    const data = await call("/admin/takeout-qrcode", {
      method: "POST",
      token: globalThis.adminToken,
    });
    if (!data.qrUrl) throw new Error("未返回 qrUrl");
  });

  await check("修改密码（改后还原）", async () => {
    await call("/admin/password", {
      method: "PUT",
      token: globalThis.adminToken,
      body: { oldPassword: "admin123", newPassword: "smoke1234" },
    });
    const relogin = await call("/admin/login", {
      method: "POST",
      body: { username: "admin", password: "smoke1234" },
    });
    await call("/admin/password", {
      method: "PUT",
      token: relogin.token,
      body: { oldPassword: "smoke1234", newPassword: "admin123" },
    });
  });

  console.log("");
  console.log(`[smoke] 通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("[smoke] 执行异常:", e);
  process.exit(1);
});
