// 一次性脚本：读取 /tmp/specs_dump.json，把旧 JSON 规格迁移到 SpecGroup/SpecOption/ProductSpecGroup
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.js";

interface DumpRow {
  id: number;
  specsJson: string | null;
}

function parseSpecs(raw: string | null): Record<string, { label: string; extra: number }[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return {};
}

const rows = JSON.parse(readFileSync("/tmp/specs_dump.json", "utf-8")) as DumpRow[];
let linked = 0;

for (const row of rows) {
  const specs = parseSpecs(row.specsJson);
  const entries = Object.entries(specs);
  if (!entries.length) continue;

  let sortOrder = 0;
  for (const [name, options] of entries) {
    if (!options?.length) continue;
    const type = /加料|配料/.test(name) ? "MULTI" : "SINGLE";
    let group = await prisma.specGroup.findUnique({ where: { name } });
    if (!group) {
      group = await prisma.specGroup.create({
        data: { name, type, sortOrder },
      });
    }
    const existingOptions = await prisma.specOption.count({ where: { groupId: group.id } });
    if (existingOptions === 0) {
      await prisma.specOption.createMany({
        data: options.map((opt, idx) => ({
          groupId: group.id,
          label: String(opt.label),
          extraPrice: Number(opt.extra || 0),
          isDefault: type === "SINGLE" && idx === 0,
          sortOrder: idx,
        })),
      });
    }
    const link = await prisma.productSpecGroup.findUnique({
      where: { productId_specGroupId: { productId: row.id, specGroupId: group.id } },
    });
    if (!link) {
      await prisma.productSpecGroup.create({
        data: { productId: row.id, specGroupId: group.id, required: true, sortOrder },
      });
      linked += 1;
    }
    sortOrder += 1;
  }
}

console.log(`[migrate-specs] 完成，共建立 ${linked} 条商品-规格组关联`);
await prisma.$disconnect();
