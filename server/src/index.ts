import "dotenv/config";
import { createApp } from "./app.js";
import { cancelStaleOrders } from "./services/order.js";

const port = Number(process.env.PORT || 3000);

createApp().listen(port, () => {
  console.log(`[coffee-os] server listening on http://localhost:${port}`);
});

// 定时清理超时未支付订单（默认 15 分钟，可用 ORDER_TIMEOUT_MINUTES 调整）
cancelStaleOrders();
setInterval(() => {
  cancelStaleOrders().catch((e) => console.error("[cron] 自动取消失败", e));
}, 5 * 60 * 1000);
