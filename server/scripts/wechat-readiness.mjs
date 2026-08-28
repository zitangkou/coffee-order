// 只报告布尔就绪状态，禁止输出环境变量、文件路径、证书或密钥内容。
const { getWechatReadiness } = await import("../dist/services/wechat.js");

const readiness = getWechatReadiness();
let failed = 0;
for (const [name, ready] of Object.entries(readiness)) {
  console.log(`[wechat-readiness] ${ready ? "✓" : "✗"} ${name}: ${ready ? "ready" : "not-ready"}`);
  if (!ready) failed += 1;
}

if (failed > 0) {
  console.error(`[wechat-readiness] ${failed} 项未就绪（未输出任何配置值）`);
  process.exit(1);
}
console.log("[wechat-readiness] 全部就绪（未输出任何配置值）");
