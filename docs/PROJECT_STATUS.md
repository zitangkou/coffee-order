# Coffee Order · 项目进度与上下文记忆

> 本文件用于记录项目进度、关键决策、环境上下文与后续待办，作为后续开发会话的交接记忆。
> 更新时间：2026-08-14

---

## 1. 项目概况

- 项目名称：**coffee-order**（本地路径 `/Users/dnn/Projects/coffee-order`）
- 产品名：Coffee OS · 单店精品咖啡店扫码点单系统
- 目标形态：H5 先行，微信小程序无缝迁移（同一套代码双端编译）
- 仓库：`git@github.com:zitangkou/coffee-order.git`（main 分支，已推送，工作区干净）
- 需求来源：5 份 AI 需求文档合并整理，见 [docs/咖啡点单系统-综合需求与设计文档.md](咖啡点单系统-综合需求与设计文档.md)

## 2. 技术栈与架构

| 层 | 技术 |
| --- | --- |
| 前端 | uni-app（Vue3 + TypeScript + Pinia），一套代码编译 H5 + 微信小程序 |
| 后端 | Node.js + TypeScript + Express + Prisma |
| 数据库 | 本地开发 SQLite；生产 MySQL 8（`server/prisma/schema.mysql.prisma`） |
| 部署 | Docker Compose（MySQL + 后端 + 前端 Nginx 三容器），Ubuntu 22.04 |

架构：`浏览器 → Nginx(:80) → /api 反代 → Node(:3000) → MySQL`，Nginx 同时托管 H5 静态产物与 `/uploads`（桌码图）。

## 3. 开发进度（按阶段）

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| Phase 0 | 项目初始化、Prisma 数据模型、seed、Design Tokens | ✅ 完成 |
| Phase 1 | 后端 API：鉴权、分类/商品/桌台、订单/支付、退款、统计、设置 | ✅ 完成，冒烟测试通过 |
| Phase 2 | 顾客端 H5：扫码进店、菜单、规格定制、购物车、下单、取餐码、退款 | ✅ 完成，双端编译通过 |
| Phase 3 | 商家后台：看板、订单工作台、商品/桌台管理、统计、设置 | ✅ 完成，双端编译通过 |
| Phase 4 | 联调打磨：手机实测、UI 走查、异常态 | 🟡 进行中（后端全流程已回归，缺真实设备走查） |
| Phase 5 | 部署准备：Docker 一键部署、PM2/Nginx 配置、部署文档 | ✅ 完成 |
| Phase 6 | 微信小程序适配：登录、微信支付、订阅消息 | 🟡 已验证双端编译，接入位待 AppID/商户号 |

## 4. 已完成功能清单

**顾客端**

- 扫码进入（URL 带 `table_id` 自动绑定桌号，可切外带）
- 首页：店铺信息、分类横滑、商品网格、底部购物车条
- 商品详情：规格组选择（杯型/温度/奶/浓度/加料，实时计价）、备注、加购
- 购物车：增删改数量、整单备注、合计
- 确认订单：堂食（选桌）/外带（手机号后四位）、包装费、提交 + 模拟支付
- 支付结果：大号取餐码、查看订单/返回首页
- 我的订单：状态筛选、订单详情（状态进度条、退款申请）

**商家端**

- 登录鉴权（JWT，默认账号 admin/admin123）
- 经营看板：今日营收/订单数/客单价/待接单
- 订单工作台：状态 Tab、接单/出餐/完成、10 秒轮询、退款审核（同意/拒绝）
- 商品管理：增删改、上下架、售罄开关、规格 JSON 编辑
- 桌台管理：增删、启停、生成/查看桌码二维码
- 数据统计：日/周/月营收、热销排行、时段分布
- 系统设置：店名、营业开关、堂食/外带、包装费、退款开关、测试打印

## 5. 关键决策与偏差记录

1. **前端 uni-app 一套代码双端**（来源文档多数派，避免二次重写）。
2. **本地开发 SQLite、生产 MySQL**：因本机网络拉取 MySQL 镜像失败，本地改用 SQLite（`schema.prisma`），生产用 `schema.mysql.prisma`；Docker 镜像构建时会自动切换 MySQL schema。
3. **H5 阶段模拟支付**（`MOCK_PAYMENT=true`），小程序阶段接微信支付。
4. **规格模型**：`specsJson` 存为 JSON 字符串（SQLite 不支持 Json 列），读写均做序列化/反序列化（`server/src/lib/json.ts`），MySQL 下同样兼容。
5. **退款 P0**：顾客申请 + 商家审核（文档决策）。
6. **会员/储值放 P1**，首期不做。
7. 订单状态机：`UNPAID → PAID → MAKING → READY → COMPLETED`，另有 `REFUNDING/REFUNDED/CANCELLED`。

## 6. 环境与常用命令（上下文记忆）

### 本机（Mac）

- 项目路径：`/Users/dnn/Projects/coffee-order`（注意：之前是 coffee_order，已重命名）
- 后端启动：`cd server && npm run dev`（监听 3000，SQLite 在 `server/prisma/dev.db`）
- 前端启动：`cd web && npm run dev:h5`（监听 5173）
- 数据初始化：`cd server && npx prisma db push && npm run seed`（幂等）
- 双端构建：`cd web && npm run build:h5` / `npm run build:mp-weixin`
- 本机当前状态（2026-08-14 检查）：后端 :3000 运行中；H5 dev :5173 已停止，需要时重启
- 注意：沙箱曾限制端口监听/网络，本机运行服务需在沙箱外执行

### 默认账号与密钥

- 商家后台：`admin / admin123`（上线前必须修改）
- 本地 JWT_SECRET：`coffee-os-dev-secret-2026`（server/.env，已被 gitignore）
- 生产 .env：由 `deploy/.env.example` 复制，需改 `WEB_BASE_URL`、MySQL 密码、`JWT_SECRET`

### 云服务器（腾讯云）

- 系统：Ubuntu 22.04 LTS，4核4G，公网 IP `124.223.178.64`
- 部署方式：Docker 一键（`./deploy.sh`），详见 [docs/部署指南.md](部署指南.md)
- 服务器拉代码走 SSH 失败（私有仓库无 Deploy Key），已给方案：生成 `~/.ssh/coffee_deploy` 公钥加到 GitHub Deploy Keys（只读）
- 登录服务器后流程：`git clone` → `cp deploy/.env.example .env` → `nano .env` → `./deploy.sh`

## 7. 后续待开发清单（TODO）

### 上线前（P0 收尾）

- [ ] **真实设备走查**：手机浏览器实测 H5 全流程，收集 UI/交互反馈
- [ ] **商品图片**：目前为占位图（首字+底色）；需要图片上传功能与真实商品图
- [ ] **服务器部署**：配置 Deploy Key → clone → .env → `./deploy.sh` → 生成桌码
- [ ] **安全加固**：修改默认管理员密码、`JWT_SECRET`、MySQL 密码；UFW 防火墙；SSH 密钥登录
- [ ] **订单取餐通知**：顾客端订单详情页增加定时轮询（当前只加载一次），出餐时提示
- [ ] **未支付订单自动取消**：定时任务清理超时 UNPAID 订单（当前无）
- [ ] **多选加料**：规格选择目前每组互斥单选；加料类应支持多选
- [ ] **外带码**：商家端生成通用外带二维码入口（当前手动切外带模式）

### 微信小程序（Phase 6）

- [ ] 接入 AppID，微信开发者工具导入 `web/dist/build/mp-weixin` 真机测试
- [ ] 微信授权登录（openid 绑定，替换 guest 登录）
- [ ] 微信支付（商户号下单 + 回调），`MOCK_PAYMENT=false`
- [ ] 订阅消息（出餐通知）
- [ ] 小程序合法域名配置、隐私协议、提审发布

### 打印对接

- [ ] 对接飞鹅/易联云云打印机：填写 `printerConfig`，`PRINTER_ENABLED=true`，实现 `server/src/services/printer.ts` 中的 HTTP 推送（当前为 stub）
- [ ] 商家端测试打印 UI 已就绪（/admin/printer/test）

### P1（二期）

- [ ] 会员体系：手机号绑定、消费记录、会员等级
- [ ] 储值与余额支付：`member_accounts`/`wallet_logs`/`recharge_records` 表已建，业务接口未做
- [ ] 数据导出 Excel
- [ ] 基础满减优惠券
- [ ] 语音提醒（商家端新单提示音已做 Web Audio，可增强）

### P2（远期）

- [ ] AI 经营分析、销售预测、客户画像、菜单优化建议
- [ ] 个性化推荐

### 工程化

- [ ] 后端自动化测试（接口回归脚本）
- [ ] 前端 E2E 测试
- [ ] HTTPS/域名（备案完成后）+ 证书自动化
- [ ] MySQL 定时备份（文档已给 crontab 示例，需在服务器配置）
- [ ] 商品图片云存储迁移（当前存服务器本地 uploads/）

## 8. 待收集资料

- 店铺名称 / Logo / 主色最终确认
- 首期商品清单与商品图
- 云打印机型号
- 微信小程序 AppID + 商户号
- 域名与备案进度
- 服务器 SSH 登录方式确认（Deploy Key 或密钥）

---

*更新进度时同步维护本文件，保证后续会话可以快速接续。*
