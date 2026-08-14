import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcrypt.hashSync("admin123", 10);
  await prisma.admin.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash, role: "MANAGER" },
  });

  await prisma.shopSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Coffee OS 精品咖啡",
      slogan: "一杯咖啡，连接慢生活",
      businessHours: "08:00 - 20:00",
      packFee: 0,
      refundEnabled: true,
      takeoutPhoneRequired: false,
    },
  });

  const catData = [
    { name: "经典咖啡", sortOrder: 1 },
    { name: "SOE 特调", sortOrder: 2 },
    { name: "手冲咖啡", sortOrder: 3 },
    { name: "茶饮", sortOrder: 4 },
    { name: "甜品", sortOrder: 5 },
  ];
  const categories: Record<string, number> = {};
  for (const c of catData) {
    const exists = await prisma.category.findFirst({ where: { name: c.name } });
    if (!exists) {
      const row = await prisma.category.create({ data: { name: c.name, sortOrder: c.sortOrder } });
      categories[c.name] = row.id;
    } else {
      categories[c.name] = exists.id;
    }
  }

  const products = [
    {
      name: "经典拿铁",
      nameEn: "Latte",
      category: "经典咖啡",
      price: 28,
      description: "经典意式浓缩与丝滑牛奶的平衡之作。",
      flavorNotes: "坚果 / 黑巧 / 焦糖",
      roastLevel: "中深烘",
      specsJson: {
        杯型: [{ label: "标准", extra: 0 }, { label: "大杯", extra: 5 }],
        温度: [{ label: "热", extra: 0 }, { label: "冰", extra: 0 }],
        奶类: [{ label: "全脂奶", extra: 0 }, { label: "燕麦奶", extra: 3 }, { label: "厚奶", extra: 4 }],
        浓度: [{ label: "标准", extra: 0 }, { label: "加浓", extra: 3 }],
        加料: [{ label: "浓缩", extra: 5 }, { label: "香草糖浆", extra: 3 }],
      },
    },
    {
      name: "冰美式",
      nameEn: "Americano",
      category: "经典咖啡",
      price: 25,
      description: "清爽直接，适合夏日的纯粹咖啡。",
      flavorNotes: "柑橘 / 坚果",
      roastLevel: "中深烘",
      specsJson: {
        杯型: [{ label: "标准", extra: 0 }, { label: "大杯", extra: 5 }],
        浓度: [{ label: "标准", extra: 0 }, { label: "加浓", extra: 3 }],
      },
    },
    {
      name: "燕麦拿铁",
      nameEn: "Oat Latte",
      category: "SOE 特调",
      price: 33,
      description: "燕麦奶自带谷物甜感，与 SOE 豆相得益彰。",
      flavorNotes: "燕麦 / 榛果 / 红糖",
      origin: "埃塞俄比亚",
      roastLevel: "中烘",
      specsJson: {
        杯型: [{ label: "标准", extra: 0 }, { label: "大杯", extra: 5 }],
        温度: [{ label: "热", extra: 0 }, { label: "冰", extra: 0 }],
        SOE豆种: [{ label: "默认拼配", extra: 0 }, { label: "埃塞俄比亚 SOE", extra: 4 }],
      },
    },
    {
      name: "手冲·埃塞俄比亚",
      nameEn: "Pour Over Ethiopia",
      category: "手冲咖啡",
      price: 38,
      description: "花果香明显，层次干净的日晒豆。",
      flavorNotes: "茉莉花 / 柑橘 / 白桃",
      origin: "埃塞俄比亚 耶加雪菲",
      roastLevel: "浅烘",
      specsJson: {
        烘焙度: [{ label: "浅烘", extra: 0 }],
        份量: [{ label: "单份", extra: 0 }, { label: "双份", extra: 15 }],
      },
    },
    {
      name: "茉莉绿茶",
      nameEn: "Jasmine Tea",
      category: "茶饮",
      price: 22,
      description: "清新茉莉，冷泡热饮皆宜。",
      flavorNotes: "茉莉 / 绿茶",
      specsJson: {
        温度: [{ label: "热", extra: 0 }, { label: "冰", extra: 0 }],
        甜度: [{ label: "无糖", extra: 0 }, { label: "三分糖", extra: 0 }, { label: "标准糖", extra: 0 }],
      },
    },
    {
      name: "巴斯克芝士蛋糕",
      nameEn: "Basque Cheesecake",
      category: "甜品",
      price: 32,
      description: "外焦内软，浓郁芝士香。",
      flavorNotes: "芝士 / 焦糖",
      specsJson: {},
    },
  ];

  for (const p of products) {
    const exists = await prisma.product.findFirst({ where: { name: p.name } });
    if (!exists) {
      await prisma.product.create({
        data: {
          name: p.name,
          nameEn: p.nameEn ?? null,
          categoryId: categories[p.category],
          price: p.price,
          description: p.description ?? null,
          flavorNotes: p.flavorNotes ?? null,
          origin: p.origin ?? null,
          roastLevel: p.roastLevel ?? null,
          specsJson: JSON.stringify(p.specsJson),
          sortOrder: 0,
        },
      });
    }
  }

  const tableNos = ["A01", "A02", "A03", "A04", "A05", "A06", "B01", "B02"];
  for (const no of tableNos) {
    await prisma.tableInfo.upsert({
      where: { tableNo: no },
      update: {},
      create: { tableNo: no },
    });
  }

  console.log("[seed] done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
