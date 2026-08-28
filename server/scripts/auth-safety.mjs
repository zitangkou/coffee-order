// 不依赖微信或短信凭据，验证管理员令牌失效、服务端强制改密及生产游客/短信关闭。
process.env.NODE_ENV = "production";
process.env.JWT_SECRET = "auth-safety-test-secret-at-least-32-characters";
process.env.SMS_PROVIDER = "disabled";
process.env.GUEST_LOGIN_ENABLED = "false";
process.env.CORS_ORIGINS = "https://nagacoffee.site";
process.env.TRUST_PROXY_HOPS = "0";

const bcrypt = (await import("bcryptjs")).default;
const { prisma } = await import("../dist/lib/prisma.js");
const { createApp } = await import("../dist/app.js");

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `auth_test_${suffix}`;
const oldPassword = `Old_${suffix}`;
const newPassword = `New_${suffix}`;
let adminId;
let server;

async function request(base, path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json() };
}

try {
  const admin = await prisma.admin.create({
    data: {
      username,
      passwordHash: bcrypt.hashSync(oldPassword, 10),
      role: "MANAGER",
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });
  adminId = admin.id;
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/api`;

  const login = await request(base, "/admin/login", {
    method: "POST",
    body: { username, password: oldPassword },
  });
  if (login.json.code !== 0 || !login.json.data?.token) throw new Error("管理员测试登录失败");
  const firstToken = login.json.data.token;

  await prisma.admin.update({ where: { id: adminId }, data: { tokenVersion: { increment: 1 } } });
  const invalidated = await request(base, "/admin/stats/today", { token: firstToken });
  if (invalidated.status !== 401) throw new Error("令牌版本变化后旧令牌未失效");

  await prisma.admin.update({
    where: { id: adminId },
    data: { mustChangePassword: true, tokenVersion: { increment: 1 } },
  });
  const relogin = await request(base, "/admin/login", {
    method: "POST",
    body: { username, password: oldPassword },
  });
  const forcedToken = relogin.json.data?.token;
  if (!forcedToken) throw new Error("强制改密账号无法登录到改密页");
  const blocked = await request(base, "/admin/stats/today", { token: forcedToken });
  if (blocked.status !== 403) throw new Error("强制改密账号仍可访问其他后台接口");

  const changed = await request(base, "/admin/password", {
    method: "PUT",
    token: forcedToken,
    body: { oldPassword, newPassword },
  });
  const freshToken = changed.json.data?.token;
  if (changed.json.code !== 0 || !freshToken) throw new Error("改密后未签发新令牌");
  const allowed = await request(base, "/admin/stats/today", { token: freshToken });
  if (allowed.json.code !== 0) throw new Error("改密后的新令牌不可用");

  await prisma.admin.update({ where: { id: adminId }, data: { status: "DISABLED" } });
  const disabled = await request(base, "/admin/stats/today", { token: freshToken });
  if (disabled.status !== 401) throw new Error("管理员禁用后旧令牌未失效");

  const guest = await request(base, "/auth/guest", {
    method: "POST",
    body: { deviceId: `auth-safety-${suffix}` },
  });
  if (guest.status !== 403) throw new Error("生产游客登录未关闭");
  const sms = await request(base, "/auth/send-code", {
    method: "POST",
    body: { phone: "13800000000" },
  });
  if (sms.status !== 503) throw new Error("生产短信禁用状态未 fail-closed");

  console.log("[auth-safety] ✓ 令牌失效、强制改密、游客与短信生产开关验证通过");
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (adminId) {
    await prisma.auditLog.deleteMany({ where: { adminId } });
    await prisma.admin.delete({ where: { id: adminId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
