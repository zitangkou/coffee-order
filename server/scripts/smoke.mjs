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

async function expectRejected(path, { method = "GET", token, body, platform } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(platform ? { "X-Platform": platform } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.code === 0) throw new Error(`${path} 不应成功`);
  return { status: res.status, json };
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

function defaultSpecs(product) {
  const specs = {};
  for (const group of product?.specGroups ?? []) {
    if (!group.required) continue;
    const option = group.options?.find((item) => item.isDefault) || group.options?.[0];
    if (option) specs[group.name] = group.type === "MULTI" ? [option.label] : option.label;
  }
  return specs;
}

async function createPaidOrder() {
  const order = await call("/orders", {
    method: "POST",
    token: globalThis.userToken,
    body: {
      orderType: "TAKEOUT",
      items: [{ productId: globalThis.firstProductId, quantity: 1, specs: defaultSpecs(globalThis.firstProduct) }],
    },
  });
  return call(`/orders/${order.id}/mock-pay`, { method: "POST", token: globalThis.userToken });
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
    globalThis.firstProduct = cats[0].products[0];
    globalThis.firstProductId = globalThis.firstProduct.id;
  });

  await check("游客登录", async () => {
    const data = await call("/auth/guest", {
      method: "POST",
      body: { deviceId: `smoke-${Date.now()}` },
    });
    if (!data.token) throw new Error("未返回 token");
    globalThis.userToken = data.token;
  });

  await check("轻会员：发码/绑定/档案", async () => {
    const phone = `138${String(Date.now()).slice(-8)}`;
    const codeRes = await call("/auth/send-code", { method: "POST", body: { phone } });
    if (!codeRes.devCode) throw new Error("开发模式应返回验证码");
    const profile = await call("/user/phone", {
      method: "POST",
      token: globalThis.userToken,
      body: { phone, code: codeRes.devCode },
    });
    if (!profile.user.phoneVerified) throw new Error("绑定后应 phoneVerified");
    if (!profile.member.level?.current?.name) throw new Error("缺少会员等级");
    const p2 = await call("/user/profile", { token: globalThis.userToken });
    if (p2.user.phone !== phone) throw new Error("档案手机号不一致");
  });

  await check("创建订单", async () => {
    const order = await call("/orders", {
      method: "POST",
      token: globalThis.userToken,
      body: {
        tableId: 1,
        orderType: "DINE_IN",
        remark: "冒烟测试",
        items: [{ productId: globalThis.firstProductId, quantity: 1, specs: defaultSpecs(globalThis.firstProduct) }],
      },
    });
    if (!order.id || !order.pickupNo) throw new Error("订单字段缺失");
    globalThis.orderId = order.id;
  });

  await check("下单参数与规格校验", async () => {
    await expectRejected("/orders", {
      method: "POST",
      token: globalThis.userToken,
      body: { orderType: "TAKEOUT", items: [] },
    });
    await expectRejected("/orders", {
      method: "POST",
      token: globalThis.userToken,
      body: {
        orderType: "DINE_IN",
        items: [{ productId: globalThis.firstProductId, quantity: 1, specs: defaultSpecs(globalThis.firstProduct) }],
      },
    });
    await expectRejected("/orders", {
      method: "POST",
      token: globalThis.userToken,
      body: {
        orderType: "TAKEOUT",
        items: [{ productId: globalThis.firstProductId, quantity: 1, specs: { 非法规格: "非法选项" } }],
      },
    });
  });

  await check("订单接口拒绝匿名与跨用户访问", async () => {
    await expectRejected(`/orders/${globalThis.orderId}`);
    await expectRejected(`/orders/${globalThis.orderId}/mock-pay`, { method: "POST" });
    await expectRejected(`/orders/${globalThis.orderId}/refund`, {
      method: "POST",
      body: { reason: "越权测试" },
    });
    const other = await call("/auth/guest", {
      method: "POST",
      body: { deviceId: `smoke-other-${Date.now()}` },
    });
    await expectRejected(`/orders/${globalThis.orderId}`, { token: other.token });
    await expectRejected(`/orders/${globalThis.orderId}/mock-pay`, {
      method: "POST",
      token: other.token,
    });
    await expectRejected(`/orders/${globalThis.orderId}/refund`, {
      method: "POST",
      token: other.token,
      body: { reason: "越权测试" },
    });
  });

  await check("模拟支付", async () => {
    const order = await call(`/orders/${globalThis.orderId}/mock-pay`, {
      method: "POST",
      token: globalThis.userToken,
    });
    if (order.status !== "PAID") throw new Error(`状态=${order.status}`);
  });

  await check("微信支付参数（mp 未配置拒绝 / H5 模拟回退）", async () => {
    const order = await call("/orders", {
      method: "POST",
      token: globalThis.userToken,
      body: {
        orderType: "TAKEOUT",
        items: [{ productId: globalThis.firstProductId, quantity: 1, specs: defaultSpecs(globalThis.firstProduct) }],
      },
    });
    const mpRes = await fetch(`${BASE}/orders/${order.id}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Platform": "mp-weixin",
        Authorization: `Bearer ${globalThis.userToken}`,
      },
      body: "{}",
    });
    const mpJson = await mpRes.json();
    if (mpJson.code === 0) throw new Error("未配置微信支付时 mp 应拒绝");
    const pending = await call(`/orders/${order.id}/payment-status`, {
      method: "POST",
      token: globalThis.userToken,
    });
    if (pending.status !== "UNPAID") throw new Error("未配置支付时查单不应改变订单状态");
    const h5 = await call(`/orders/${order.id}/pay`, {
      method: "POST",
      token: globalThis.userToken,
    });
    if (h5.status !== "PAID") throw new Error("H5 模拟支付应成功");
  });

  await check("微信登录/订阅（未配置明确报错，订阅可保存）", async () => {
    const wxRes = await fetch(`${BASE}/auth/wx-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "smoke-test-code" }),
    });
    const wxJson = await wxRes.json();
    if (wxJson.code === 0) throw new Error("未配置小程序时应拒绝微信登录");
    await call("/user/subscribe", {
      method: "POST",
      token: globalThis.userToken,
      body: { templateId: "SMOKE_TEMPLATE", status: "ACCEPTED" },
    });
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
    await expectRejected(`/admin/orders/${globalThis.orderId}/status`, {
      method: "PATCH",
      token: globalThis.adminToken,
      body: { status: "CANCELLED" },
    });
    let o = await call(`/admin/orders/${globalThis.orderId}/status`, {
      method: "PATCH",
      token: globalThis.adminToken,
      body: { status: "MAKING" },
    });
    if (o.status !== "MAKING") throw new Error(`状态=${o.status}`);
    // 原子流转：重复接单应失败
    const dup = await fetch(`${BASE}/admin/orders/${globalThis.orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${globalThis.adminToken}`,
      },
      body: JSON.stringify({ status: "MAKING" }),
    });
    if ((await dup.json()).code === 0) throw new Error("重复接单不应成功");
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
    if (done.status !== "SUCCESS" || !done.outRefundNo) throw new Error(`资金退款状态=${done.status}`);
  });

  await check("拒绝退款恢复原订单状态", async () => {
    const paid = await createPaidOrder();
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        fetch(`${BASE}/orders/${paid.id}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalThis.userToken}` },
          body: JSON.stringify({ reason: "拒绝流程测试" }),
        }).then((res) => res.json())
      )
    );
    if (concurrent.filter((item) => item.code === 0).length !== 1) {
      throw new Error("并发退款申请必须且只能成功一次");
    }
    const refunds = await call("/admin/refunds", { token: globalThis.adminToken });
    const refund = refunds.find((item) => item.orderId === paid.id);
    const done = await call(`/admin/refunds/${refund.id}`, {
      method: "PUT",
      token: globalThis.adminToken,
      body: { action: "rejected", rejectReason: "测试拒绝" },
    });
    if (done.status !== "REJECTED" || done.order.status !== "PAID") {
      throw new Error(`拒绝后退款=${done.status},订单=${done.order.status}`);
    }
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

  await check("规格组列表", async () => {
    const groups = await call("/admin/spec-groups", { token: globalThis.adminToken });
    if (!groups.length) throw new Error("无规格组");
    if (!groups.some((g) => g.options?.length)) throw new Error("规格组无选项");
  });

  await check("商品搜索", async () => {
    const list = await call("/admin/products?keyword=拿铁&status=on", {
      token: globalThis.adminToken,
    });
    if (!list.some((p) => p.name.includes("拿铁"))) throw new Error("搜索未命中");
  });

  await check("规格组 CRUD 与商品关联", async () => {
    const pid = globalThis.firstProductId;
    const all = await call("/admin/products", { token: globalThis.adminToken });
    const product = all.find((p) => p.id === pid);
    const beforeIds = (product?.specGroups ?? []).map((g) => ({
      specGroupId: g.id,
      required: g.required,
    }));
    const created = await call("/admin/spec-groups", {
      method: "POST",
      token: globalThis.adminToken,
      body: {
        name: `临时组${Date.now()}`,
        type: "MULTI",
        options: [{ label: "A", extraPrice: 0, isDefault: false }],
      },
    });
    const updated = await call(`/admin/products/${pid}`, {
      method: "PUT",
      token: globalThis.adminToken,
      body: { specGroupIds: [{ specGroupId: created.id, required: true }] },
    });
    if (!updated.specGroups.some((g) => g.id === created.id)) {
      throw new Error("商品未关联新规格组");
    }
    // 被商品占用时应拒绝删除
    const blocked = await fetch(`${BASE}/admin/spec-groups/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${globalThis.adminToken}` },
    });
    if ((await blocked.json()).code === 0) throw new Error("被占用规格组不应可删除");
    // 还原商品规格并清理临时组
    await call(`/admin/products/${pid}`, {
      method: "PUT",
      token: globalThis.adminToken,
      body: { specGroupIds: beforeIds },
    });
    await call(`/admin/spec-groups/${created.id}`, {
      method: "DELETE",
      token: globalThis.adminToken,
    });
  });

  await check("外带码生成", async () => {
    const data = await call("/admin/takeout-qrcode", {
      method: "POST",
      token: globalThis.adminToken,
    });
    if (!data.qrUrl) throw new Error("未返回 qrUrl");
  });

  await check("统计扩展（趋势/品类/退款）", async () => {
    const t = await call("/admin/stats/trend?days=7", { token: globalThis.adminToken });
    if (!Array.isArray(t) || t.length !== 7) throw new Error("趋势数据异常");
    const c = await call("/admin/stats/categories?range=today", { token: globalThis.adminToken });
    if (!Array.isArray(c)) throw new Error("品类占比异常");
    const rf = await call("/admin/stats/refunds?range=today", { token: globalThis.adminToken });
    if (typeof rf.count !== "number" || typeof rf.amount !== "number") {
      throw new Error("退款统计异常");
    }
  });

  await check("管理员创建与权限隔离", async () => {
    const uname = `staff_${Date.now()}`;
    const created = await call("/admin/admins", {
      method: "POST",
      token: globalThis.adminToken,
      body: { username: uname, password: "staff123", role: "STAFF" },
    });
    if (created.role !== "STAFF") throw new Error("角色错误");
    const staffLogin = await call("/admin/login", {
      method: "POST",
      body: { username: uname, password: "staff123" },
    });
    const forbidden = await fetch(`${BASE}/admin/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffLogin.token}`,
      },
      body: JSON.stringify({ name: "越权测试", categoryId: 1, price: 1 }),
    });
    if ((await forbidden.json()).code === 0) throw new Error("店员不应能新增商品");
    await call(`/admin/admins/${created.id}`, {
      method: "PUT",
      token: globalThis.adminToken,
      body: { status: "DISABLED" },
    });
    const disabledLogin = await fetch(`${BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: uname, password: "staff123" }),
    });
    if ((await disabledLogin.json()).code === 0) throw new Error("禁用账号不应能登录");
  });

  await check("审计日志", async () => {
    const logs = await call("/admin/audit-logs", { token: globalThis.adminToken });
    if (!Array.isArray(logs) || !logs.length) throw new Error("无审计记录");
  });

  await check("支付回调 fail-closed（未配置商户时拒绝）", async () => {
    for (const path of ["/payment/callback", "/refund/callback"]) {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dummy: true }),
      });
      const json = await res.json();
      if (json.code !== "FAIL") throw new Error(`未配置微信支付时 ${path} 必须被拒绝`);
    }
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

  await check("账号注销后旧令牌失效", async () => {
    const guest = await call("/auth/guest", {
      method: "POST",
      body: { deviceId: `smoke-deactivate-${Date.now()}` },
    });
    await call("/user/deactivate", {
      method: "POST",
      token: guest.token,
      body: { confirm: "确认注销" },
    });
    await expectRejected("/user/profile", { token: guest.token });
  });

  console.log("");
  console.log(`[smoke] 通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("[smoke] 执行异常:", e);
  process.exit(1);
});
