export async function printOrder(order: unknown): Promise<void> {
  const orderNo = String((order as any)?.orderNo || "unknown");
  if (process.env.PRINTER_ENABLED !== "true") {
    console.log("[printer] 打印已关闭，跳过:", orderNo);
    return;
  }
  console.log("[printer] 云打印机推送订单:", orderNo);
  // TODO: 按 shop_settings.printerConfig 对接飞鹅/易联云 HTTP API
}
