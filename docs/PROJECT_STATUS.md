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
| Phase 4 | 联调打磨：手机实测、UI 走查、异常态 | 🟡 进行中（功能收尾已补齐并回归，缺真实设备走查） |
| Phase 5 | 部署准备：Docker 一键部署、PM2/Nginx 配置、部署文档 | ✅ 完成 |
| Phase 6 | 微信小程序适配：登录、微信支付、订阅消息 | 🟡 已验证双端编译，接入位待 AppID/商户号 |

## 4. 已完成功能清单

**顾客端**

- 扫码进入（URL 带 `table_id` 自动绑定桌号，可切外带）
- 首页：店铺信息、分类横滑、商品网格、底部购物车条
- 商品详情：规格组选择（杯型/温度/奶/浓度/加料，实时计价；加料组支持多选）、备注、加购
- 购物车：增删改数量、整单备注、合计
- 确认订单：堂食（选桌）/外带（手机号后四位）、包装费、提交 + 模拟支付
- 支付结果：大号取餐码、查看订单/返回首页
- 我的订单：状态筛选、订单详情（状态进度条、退款申请、10s 轮询 + 出餐弹窗提醒）

**商家端**

- 登录鉴权（JWT，默认账号 admin/admin123）
- 经营看板：今日营收/订单数/客单价/待接单
- 订单工作台：状态 Tab、接单/出餐/完成、10 秒轮询、退款审核（同意/拒绝）
- 商品管理：增删改、上下架、售罄开关、规格 JSON 编辑
- 桌台管理：增删、启停、生成/查看桌码二维码、外带码
- 数据统计：日/周/月营收、热销排行、时段分布
- 系统设置：店名、营业开关、堂食/外带、包装费、退款开关、测试打印、修改密码
- 商品图片：商家端上传（multer，5MB 限制，存 uploads/products/）
- 后端定时任务：自动取消超时未支付订单（默认 15 分钟，`ORDER_TIMEOUT_MINUTES` 可调）

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

- [x] **商品图片上传**（2026-08-14：后端 multer 接口 + 商家端传图按钮）
- [x] **订单取餐通知**（2026-08-14：订单详情 10s 轮询，READY 弹窗）
- [x] **未支付订单自动取消**（2026-08-14：定时任务）
- [x] **多选加料**（2026-08-14：规格组 `multiple: true`）
- [x] **外带码**（2026-08-14：桌台管理生成/查看）
- [x] **商家端修改密码**（2026-08-14：设置页）
- [x] **后端冒烟测试**（2026-08-14：`npm run smoke`，12 项用例）
- [ ] **真实设备走查**：手机浏览器实测 H5 全流程，收集 UI/交互反馈
- [ ] **真实商品图**：目前为占位图（首字+底色），需提供实际图片上传
- [ ] **服务器部署**：配置 Deploy Key → clone → .env → `./deploy.sh` → 生成桌码
- [ ] **安全加固**：修改默认管理员密码、`JWT_SECRET`、MySQL 密码；UFW 防火墙；SSH 密钥登录

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

## 11. 部署与协作进展（2026-08-15 晚）

- 云服务器（腾讯云 124.223.178.64，Ubuntu 22.04）已按**方案 B（域名网关）**切换：coffee compose 显式 `name: coffee-order`，web 只监听 `127.0.0.1:8080`；宿主机 Nginx 做网关（`server_name _` 转发 8080）。
- Docker 全局配置已拆为一次性 `deploy/setup-docker.sh`；`deploy.sh` 仅构建启动本项目。
- 多项目：`docs/多项目部署指南.md` + 可复制模板 `deploy/project-template/`（8081 起步）。
- 兄弟项目 zhixing-gongkao（知行公考）确认已自带 Docker 化（8081，H5+Python 后端+管理后台），无需套模板；过渡期直接 IP:8081，正式期走网关域名 server 块。注意其 Dockerfile 禁用 alpine（Taro binding 需 glibc）。
- 待办：迭代 C（安全 P0：支付回调验签/HTTPS/接口限流/数据库备份自动化；会员储值；监控告警）。支付与 HTTPS 相关项在正式营业前必须完成。

---

## 9. 迭代 A（P0）完成记录 · 2026-08-15

按 [docs/优化方案.md](优化方案.md) 完成点单体验闭环：

- 规格系统去 JSON 化：新增 `SpecGroup / SpecOption / ProductSpecGroup` 三张表，商品移除 `specsJson`，附一次性迁移脚本（`npm run dump:specs` → `prisma db push --accept-data-loss` → `npm run migrate:specs`）。
- 商品新增 `isSignature / isHot` 标记：顾客端提供「全部 / 招牌 / 热销」快捷筛选 + 分类抽屉（底部浮层，带搜索）。
- 顾客端：菜单页「＋」改为规格弹层加购（`components/SpecSheet.vue`）；规格默认值自动选中（`isDefault`，单选必选组默认第一个）；堂食/外带与桌号持久化，切回堂食无桌号自动弹选桌。
- 商家端：商品页新增搜索/分类/状态筛选；商品编辑改为可视化规格配置（勾选规格组 + 必选开关 + 新建规格组表单）；登录页居中；看板指标可跳转订单/统计。
- 冒烟测试扩展至 15 项（含规格组 CRUD、商品搜索、商品规格关联），全部通过；H5 与微信小程序双端构建通过。

## 10. 迭代 B（P1）完成记录 · 2026-08-15

- 管理员体系：`Admin.status`（启用/禁用）、管理员增删改接口（仅 MANAGER）、角色权限隔离（店员可接单/售罄，店长可管商品/设置/退款/管理员）。
- 审计日志：`AuditLog` 表 + 订单状态、退款审核、商品、设置、管理员、规格组等关键操作留痕，商家端「管理员」页可查最近 50 条。
- 并发安全：订单状态流转与退款审核改为原子条件更新（`updateMany where 旧状态`），双人同时操作只有一个成功。
- 订单步骤条：`components/StepBar.vue` 四步流程（已支付→制作中→待取餐→已完成），退款/取消用独立状态卡。
- 统计扩展：近 7 天营收趋势、品类销售占比、退款统计，数据可导出 CSV（Excel 可打开）。
- 冒烟测试扩展至 18 项（原子流转、管理员权限隔离、审计日志、统计扩展），全部通过；双端构建通过。

## 11. 迭代 C 安全 P0 完成记录 · 2026-08-15

- 接口限流：`express-rate-limit`，全局默认 300 次/分钟/IP；登录接口 5 次/15 分钟/IP（防暴力破解），阈值与开关可配（`RATE_LIMIT_DISABLED / API_RATE_LIMIT / LOGIN_RATE_LIMIT`）。
- 支付回调：`services/payment.ts` 实现微信支付 v3 回调验签（RSA-SHA256）+ AES-256-GCM 解密 + 金额二次校验 + 交易号幂等；**fail-closed**——未配置商户证书/密钥时回调一律拒绝；冒烟测试已覆盖。
- 密码策略：管理员密码最少 8 位；新建管理员强制首登改密；默认密码 `admin123` 被检测到时强制开启改密（`Admin.mustChangePassword`）；修改密码后清除标记。
- 登录态：管理员 JWT 有效期由 7 天收紧为 2 天。
- Nginx：安全响应头（X-Content-Type-Options / X-Frame-Options / Referrer-Policy / CSP）。
- 数据库备份：`deploy/backup.sh`（mysqldump + gzip + 保留 14 天）+ `deploy/install-backup.sh`（crontab 每日 03:00）。
- 冒烟测试扩展至 19 项，全部通过；双端构建通过。

**仍依赖外部条件的项（代码/配置已就绪，待激活）**：

- 全站 HTTPS：待域名 + ICP 备案（证书与 Nginx 网关配置见部署文档）。
- 微信支付正式接入：待商户号 + APIv3 密钥 + 平台证书（配置 `WECHAT_API_V3_KEY` / `WECHAT_PLATFORM_CERT_PATH` 后自动启用验签回调）。
- MySQL 端口：容器默认不暴露公网（compose 仅内网 expose），已满足。

## 12. 轻会员（咖啡档案）完成记录 · 2026-08-16

- 手机号绑定：`POST /auth/send-code`（验证码 5 分钟有效、60 秒重发冷却）+ `POST /user/phone`（绑定校验、防重复绑定），短信默认 console 模式（验证码打印日志/接口返回），生产可切换短信服务商。
- 消费档案：`GET /user/profile` 返回累计消费、消费次数、最近消费时间、等级与最近 20 条消费记录（按已支付订单统计，退款/取消不计入）。
- 等级体系：累计消费自动升级（咖啡新友 → 咖啡常客 ¥500 → 咖啡老友 ¥1500 → 咖啡大师 ¥3000），含升级进度。
- 顾客端：新增「咖啡档案」页（首页入口），未绑定手机号时引导绑定；已绑定展示等级徽章、统计卡片、进度条与消费记录。
- 冒烟测试扩展至 20 项（发码/绑定/档案），全部通过；双端构建通过。

**明确暂缓**：储值（含 MemberAccount/WalletLog/RechargeRecord 表已建，待有稳定熟客与资金合规准备后再做）；AI 分析（待数据积累 3–6 个月后评估）。

## 13. 微信小程序 Phase 6 代码骨架完成记录 · 2026-08-16

- 微信登录：`POST /auth/wx-login`（code 换 openid，`User.wxOpenid` 唯一绑定）；前端小程序端优先微信登录，失败回退游客登录。
- 微信支付：`POST /orders/:id/pay` 按 `X-Platform: mp-weixin` 区分——小程序端返回 `wx.requestPayment` 参数（JSAPI 下单 + RSA 签名，未配置资质 fail-closed），H5 端保持模拟支付；下单页接入收银台拉起与取消处理。
- 订阅消息：`POST /user/subscribe` 保存授权；订单出餐（READY）时向已订阅微信用户推送取餐通知（best-effort）；支付成功页引导订阅（模板 ID 未配置时跳过）。
- 平台适配：`utils/platform.ts` 条件编译封装 `wx.login / requestPayment / requestSubscribeMessage`，H5 端零影响。
- 配置项：`WECHAT_MP_APPID / WECHAT_MP_SECRET / WECHAT_MCH_ID / WECHAT_MCH_SERIAL / WECHAT_MCH_PRIVATE_KEY_PATH / WECHAT_SUBSCRIBE_TEMPLATE_READY`（compose 与 .env.example 已就绪）。
- 冒烟测试扩展至 22 项（mp 支付 fail-closed、H5 回退、微信登录未配置报错、订阅保存），全部通过；双端构建通过。

**待资质就绪后**：填 AppID/Secret/商户号/证书/模板 ID → 微信开发者工具导入 `web/dist/build/mp-weixin` 真机调试 → 配置合法域名 → 提审发布。
