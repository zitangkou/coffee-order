// 不依赖已启动服务的安全门禁：正式模式下模拟支付必须 fail-closed。
process.env.MOCK_PAYMENT = "false";

const { mockPay } = await import("../dist/services/order.js");

try {
  await mockPay(0, 1);
  console.error("[security] 模拟支付在正式模式下意外成功");
  process.exit(1);
} catch (error) {
  if (!String(error?.message || error).includes("模拟支付未启用")) {
    console.error("[security] 返回了非预期错误", error);
    process.exit(1);
  }
  console.log("[security] ✓ 正式模式已拒绝模拟支付");
}
