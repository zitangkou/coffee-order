# 咖啡点单应用gemini

# 独立精品咖啡馆扫码点单系统需求与设计文档 (PRD & SDD)

---

## 1. 项目概述与架构策略

### 1.1 项目背景

本系统为单体独立精品咖啡馆定制开发。系统旨在打通线上与线下点单流程，提供高质感的品牌呈现与极简高效的操作体验。

### 1.2 演进式部署策略

为了规避域名备案与微信小程序认证周期对上线进度的影响，项目采用**两阶段演进架构**：

```
+-----------------------------------------------------------------------+
| Phase 1: 响应式 H5 应用 (基于 Uniapp)                                   |
| - 部署在现有云服务器 (通过 IP/暂存域名访问)                               |
| - 店内贴码运行，提供完整扫码点单、自提、储值与商家接单功能                    |
+-----------------------------------------------------------------------+
                                  │
                                  ▼ (域名备案完成 / 微信认证就绪)
+-----------------------------------------------------------------------+
| Phase 2: 无缝导出微信小程序                                              |
| - 代码零成本打包迁移至微信小程序生态                                     |
| - 接入微信原生支付、订阅消息推送、微信授权登录                             |
+-----------------------------------------------------------------------+

```

---

## 2. 详细产品需求文档 (PRD)

### 2.1 业务流程图

```
                +-----------------------+
                | 顾客扫桌码 / 访问 H5  |
                +-----------+-----------+
                            |
           +----------------+----------------+
           |                                 |
  【有桌号: 堂食模式】              【无桌号: 自提模式】
           |                                 |
           +----------------+----------------+
                            |
                            v
                 +---------------------+
                 | 选购商品与豆种/规格 |
                 +----------+----------+
                            |
                            v
                 +---------------------+
                 | 结算 (选余额/微信支付)|
                 +----------+----------+
                            |
                            v
                 +---------------------+
                 |  生成订单与取餐码    |
                 +----------+----------+
                            |
              +-------------+-------------+
              |                           |
              v                           v
    +-------------------+       +-------------------+
    | 商家端收到订单提示 |       | 云打印机自动打印  |
    +---------+---------+       +-------------------+
              |
              v
    +-------------------+
    | 接单 -> 制作 -> 叫号|
    +-------------------+

```

### 2.2 角色与权限矩阵


| 功能模块                 | 顾客 (Customer) | 员工 (Staff / 咖啡师) | 店长 / 老板 (Manager) |
| -------------------- | ------------- | ---------------- | ----------------- |
| **扫码点单 / 自提**        |          | ❌                | ❌                 |
| **账户余额储值**           |          | ❌                | ❌                 |
| **订单状态追踪**           | （仅本人订单）       |             |              |
| **订单实时接单 / 叫号 / 完结** | ❌             |             |              |
| **饮品临时估清 / 上下架**     | ❌             |             |              |
| **饮品/规格/价格编辑**       | ❌             | ❌                |              |
| **订单退款处理**           | ❌             | ❌（仅提交申请）         |              |
| **储值规则配置与统计**        | ❌             | ❌                |              |


---

### 2.3 核心功能模块说明

#### 1. 顾客端 (C端 H5 / 小程序)

- **桌号绑定与模式切换**：
- URL 携带 `table_id` 时，自动进入堂食模式并锁定桌号。
- 无 `table_id` 时，强制切换为提前自提模式，可选择预计取餐时间。
- **精品咖啡菜单**：
- 商品列表醒目标注 **产区/豆种**、**烘焙度 (浅/中/深烘)** 及 **风味描述 (Flavor Notes)**。
- 支持加价更换 SOE 豆种（例如：+¥4 更换埃塞俄比亚 SOE）。
- **个性化定制弹窗 (SKU/Specs)**：
- 多组胶囊单选项：温度/冰度（热/少冰/正常冰）、奶质替换（全脂奶/燕麦奶/厚创奶）、浓度（标准/加浓）。
- **结算与支付**：
- 支持选择“堂食 / 打包”（打包时按规则收取包装费）。
- 支付方式：储值余额扣减、微信支付。余额不足时支持组合支付或一键跳转充值。
- **叫号与订单追踪**：
- 订单页展示特大字号**取餐码 (如 S008)** 及制作状态进度。

#### 2. 商家端 (B端 H5 / 工作台)

- **订单工作台**：
- 按状态分类（待处理/制作中/待取餐/已完成）。
- 新订单到达时，通过 Web Audio 播放语音提醒（“您有新的咖啡订单，请处理”）。
- **饮品估清**：咖啡师可在忙碌时一键将某种豆子或饮品设为“售罄”。
- **桌台二维码管理**：可输入桌号，前端动态生成对应的点单二维码。

---

## 3. 极简精品咖啡 UI/UX 规范设计 (SDD)

系统采用**极简高冷/暖质感精品咖啡风格**，强调图片质感与排版呼吸感。

### 3.1 设计变量配置 (Design Tokens)

```css
:root {
  /* 品牌色系 */
  --primary-color: #1A1A1A;     /* 主文字/主要按钮: 黑曜石黑 */
  --bg-color: #F7F6F2;          /* 主背景: 暖白/燕麦色 */
  --card-bg: #FFFFFF;          /* 卡片背景: 纯白 */
  --accent-color: #C8A279;      /* 强调色: 暖咖/烘焙色 (风味标签、高亮) */
  --text-muted: #8C8C8C;        /* 次要文字: 灰色 */
  
  /* 布局与圆角 */
  --border-radius-sm: 4px;      /* 标签圆角 */
  --border-radius-card: 8px;    /* 商品卡片圆角 (利落硬朗) */
  --border-radius-btn: 24px;    /* 胶囊按钮圆角 */
  
  /* 字体 */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

```

### 3.2 布局规范示意

- **菜单商品卡片 (Card Layout)**：
- 图片占比 30%，右侧文字排版：上方为饮品中文名与英文名，中间为浅灰色小字风味描述（如 `茉莉花 / 柑橘 / 白桃`），下方展示价格与底色为 `#C8A279` 的烘焙度标签。
- **商家端高对比度模式**：
- 商家工作台采用暗色模式 (`#121212`)，特殊定制要求（如“加浓”、“燕麦奶”）用高亮黄字显示，确保咖啡师一目了然。

---

## 4. 系统架构与数据库设计 (SDD)

### 4.1 技术栈选型

- **前端**：Uniapp (Vue3) + Pinia + TailwindCSS / UnoCSS（单套代码编译为 H5 与 微信小程序）。
- **后端**：Node.js (TypeScript) + Express / Fastify。
- **ORM 与数据库**：Prisma ORM + MySQL 8.0。
- **服务器环境**：Linux (Ubuntu/CentOS) + Nginx + PM2。

### 4.2 数据库物理模型 (Prisma Schema 定义)

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// 1. 用户表
model User {
  id              BigInt            @id @default(autoincrement())
  openid          String?           @unique // 微信 OpenID (Phase 2)
  phone           String            @unique
  nickname        String            @default("精品咖啡爱好者")
  balance         Decimal           @default(0.00) @db.Decimal(10, 2)
  role            Role              @default(CUSTOMER)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  orders          Order[]
  rechargeRecords RechargeRecord[]
}

enum Role {
  CUSTOMER
  STAFF
  MANAGER
}

// 2. 商品表 (包含精品咖啡特性)
model Goods {
  id          Int         @id @default(autoincrement())
  name        String
  category    String      // 如: SOE特调, 经典意式, 手冲咖啡
  price       Decimal     @db.Decimal(10, 2)
  imageUrl    String
  origin      String?     // 产区/豆种: 如 埃塞俄比亚
  roastLevel  String?     // 烘焙度: 浅烘/中烘/深烘
  flavorNotes String?     // 风味描述: 如 柑橘、白桃
  isAvailable Boolean     @default(true)
  specsJson   Json        // 规格与加价配置
  createdAt   DateTime    @default(now())
  orderItems  OrderItem[]
}

// 3. 订单表
model Order {
  id          BigInt      @id @default(autoincrement())
  orderSn     String      @unique
  userId      BigInt
  user        User        @relation(fields: [userId], references: [id])
  pickupCode  String      // 取餐码，如 S001
  orderType   OrderType   @default(DINE_IN)
  tableNumber String?     // 桌号
  totalAmount Decimal     @db.Decimal(10, 2)
  packFee     Decimal     @default(0.00) @db.Decimal(10, 2)
  payType     PayType
  status      OrderStatus @default(UNPAID)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  items       OrderItem[]
}

enum OrderType {
  DINE_IN
  TAKEOUT
}

enum PayType {
  WECHAT
  BALANCE
}

enum OrderStatus {
  UNPAID
  PAID
  MAKING
  READY
  COMPLETED
  REFUNDED
}

// 4. 订单明细表
model OrderItem {
  id        BigInt   @id @default(autoincrement())
  orderId   BigInt
  order     Order    @relation(fields: [orderId], references: [id])
  goodsId   Int
  goods     Goods    @relation(fields: [goodsId], references: [id])
  goodsName String
  specsText String?  // 如: 少冰 / 燕麦奶(+¥4) / SOE豆
  price     Decimal  @db.Decimal(10, 2)
  quantity  Int      @default(1)
}

// 5. 储值流水表
model RechargeRecord {
  id        BigInt   @id @default(autoincrement())
  userId    BigInt
  user      User     @relation(fields: [userId], references: [id])
  payAmount Decimal  @db.Decimal(10, 2)
  giveAmount Decimal @default(0.00) @db.Decimal(10, 2)
  status    String   @default("SUCCESS")
  createdAt DateTime @default(now())
}

```

---

## 5. Claude Code 可执行任务清单 (Task Checklist)

针对 Claude Code 执行，以下是将项目分阶段拆解的任务命令：

```markdown
# Claude Code Execution Plan - Specialty Coffee Ordering System

## Phase 1: Infrastructure & DB Schema
- [ ] Task 1.1: Initialize a Node.js TypeScript project with Express/Fastify, ESLint, and dotenv.
- [ ] Task 1.2: Setup Prisma ORM with MySQL and apply the provided Prisma Schema (User, Goods, Order, OrderItem, RechargeRecord).
- [ ] Task 1.3: Create a database seed script (`prisma/seed.ts`) with coffee categories (SOE特调, 经典意式, 手冲咖啡), specialty coffee goods with flavor notes, and a default MANAGER user.
- [ ] Task 1.4: Initialize a Uniapp (Vue3 + TypeScript) project, set up Pinia, and configure a custom HTTP request client (`src/utils/request.ts`).

## Phase 2: Core RESTful APIs
- [ ] Task 2.1: Implement Auth API (`POST /api/auth/mock-login`, `GET /api/user/profile`).
- [ ] Task 2.2: Implement Goods API (`GET /api/goods`, `POST /api/goods`, `PATCH /api/goods/:id/status`).
- [ ] Task 2.3: Implement Order & Payment API (`POST /api/orders`, `POST /api/orders/:id/pay-balance`, `GET /api/orders/my`). Ensure balance deduction and unique pickupCode (e.g., S001) generation logic.
- [ ] Task 2.4: Implement Merchant Admin API (`GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`).

## Phase 3: Customer H5 Frontend (Specialty Coffee UI)
- [ ] Task 3.1: Configure design tokens in TailwindCSS (#F7F6F2 bg, #1A1A1A text, #C8A279 accent).
- [ ] Task 3.2: Build Menu Page with table_id URL parser, Dine-in/Takeout switcher, category sidebar, and coffee goods cards featuring origin, roast level, and flavor notes.
- [ ] Task 3.3: Build SKU Spec Modal supporting SOE bean upgrade, milk alternatives, and temperature options.
- [ ] Task 3.4: Build Checkout & Order Detail Pages displaying a prominent pickup code and real-time status bar.

## Phase 4: Merchant H5 Workbench & Hardware Integration
- [ ] Task 4.1: Build Merchant Order Workbench with Web Audio alert on new order arrival.
- [ ] Task 4.2: Add a printer service utility (`src/services/printer.ts`) to send printer commands to a cloud thermal printer upon order payment.

## Phase 5: Deployment Preparation
- [ ] Task 5.1: Create PM2 `ecosystem.config.js` and Nginx reverse proxy configuration file for HTTP/IP access.

```

 