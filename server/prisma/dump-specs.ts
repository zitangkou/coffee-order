// 一次性脚本：在 db push 删除 specsJson 前，把旧规格数据导出到 /tmp/specs_dump.json
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.js";

const rows = await prisma.$queryRawUnsafe("SELECT id, specsJson FROM Product");
writeFileSync("/tmp/specs_dump.json", JSON.stringify(rows, null, 2));
console.log(`[dump-specs] 已导出 ${rows.length} 条商品规格`);
await prisma.$disconnect();
