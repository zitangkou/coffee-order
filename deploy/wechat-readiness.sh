#!/usr/bin/env bash
# 在运行中的 API 容器内做微信配置就绪检查；仅输出 ready/not-ready。
# 生产镜像只包含运行依赖，不在服务器现场调用 tsc。
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T server node --input-type=module -e '
  const { getWechatReadiness } = await import("./dist/services/wechat.js");
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
'
