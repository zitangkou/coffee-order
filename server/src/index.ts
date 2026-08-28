import "dotenv/config";
import { createApp } from "./app.js";
import { cancelStaleOrders } from "./services/order.js";
import { syncProcessingWechatRefunds } from "./services/payment.js";

const port = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV === "production") {
  const jwtSecret = process.env.JWT_SECRET || "";
  if (jwtSecret.length < 32 || /please-change|dev-secret|coffee-os/i.test(jwtSecret)) {
    throw new Error("生产环境 JWT_SECRET 必须设置为至少 32 位的随机强密钥");
  }
  if (process.env.MOCK_PAYMENT === "true") {
    throw new Error("生产环境禁止启用 MOCK_PAYMENT");
  }
  const smsProvider = process.env.SMS_PROVIDER || "disabled";
  if (smsProvider === "console") {
    throw new Error("生产环境禁止使用 console 短信服务");
  }
  if (smsProvider !== "disabled") {
    throw new Error("当前版本尚未实现生产短信供应商，请先保持 SMS_PROVIDER=disabled");
  }
  if (process.env.GUEST_LOGIN_ENABLED === "true") {
    throw new Error("生产环境禁止启用游客登录");
  }
}

createApp().listen(port, () => {
  console.log(`[coffee-os] server listening on http://localhost:${port}`);
});

// 定时清理超时未支付订单（默认 15 分钟，可用 ORDER_TIMEOUT_MINUTES 调整）
cancelStaleOrders().catch((e) => console.error("[cron] 首次自动取消失败", e));
syncProcessingWechatRefunds().catch((e) => console.error("[cron] 首次退款状态同步失败", e));
setInterval(() => {
  cancelStaleOrders().catch((e) => console.error("[cron] 自动取消失败", e));
  syncProcessingWechatRefunds().catch((e) => console.error("[cron] 退款状态同步失败", e));
}, 5 * 60 * 1000);
