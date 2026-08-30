# Coffee OS · 精品咖啡店扫码点单系统

单店精品咖啡店的轻量数字化经营系统：**微信小程序顾客端优先发布，商家 Web 后台保留**；顾客端 H5 暂缓。

## 技术栈

| 端 | 技术 |
| --- | --- |
| 顾客端/商家端前端 | uni-app（Vue3 + TypeScript + Pinia），编译 H5 与微信小程序 |
| 后端 | Node.js + TypeScript + Express + Prisma |
| 数据库 | 本地开发 SQLite；生产 MySQL 8（schema 见 `server/prisma/schema.mysql.prisma`） |
| 部署 | Docker Compose（MySQL + Node.js API + Nginx） |

## 目录结构

```
coffee-order/
├── server/                # 后端 API
│   ├── prisma/            # schema.prisma（SQLite）/ schema.mysql.prisma（生产）
│   ├── src/
│   │   ├── routes/        # customer / admin 路由
│   │   ├── services/      # 订单、支付、统计、打印
│   │   └── lib/           # prisma、jwt、响应封装
│   ├── docker-compose.yml # 生产 MySQL 8
│   └── .env.example
├── web/                   # uni-app 前端（H5 + 微信小程序）
│   └── src/
│       ├── pages/         # 顾客端页面
│       ├── pages_admin/   # 商家后台页面
│       ├── stores/        # user / cart
│       ├── api/           # 接口封装
│       └── utils/         # request 封装
└── docs/                  # 综合需求与设计文档
```

## 本地开发

### 1. 启动后端

```bash
cd server
npm install
cp .env.example .env
npx prisma db push      # 初始化 SQLite（server/prisma/dev.db）
npm run seed            # 写入默认管理员/分类/商品/桌台
npm run dev             # http://localhost:3000
```

本地开发默认商家账号：`admin / admin123`。生产部署会随机生成一次性管理员密码，不使用该默认值。

### 2. 启动前端 H5

```bash
cd web
npm install
npm run dev:h5          # http://localhost:5173
```

扫码桌码进入示例：`http://localhost:5173/#/pages/index/index?table_id=1`

### 3. 构建

```bash
cd web
npm run build:h5        # H5 产物 dist/build/h5
npm run build:mp-weixin # 微信小程序产物 dist/build/mp-weixin
```

小程序产物用微信开发者工具导入 `web/dist/build/mp-weixin` 即可预览。

## 生产部署（Docker 一键方案，推荐）

腾讯云 4核4G 可支撑首发阶段。仓库根目录已提供完整 Docker 化部署（MySQL + 非 root API + 非 root 前端 Nginx，并带备份、恢复校验和监控脚本）。

完整图文步骤见 **[docs/部署指南.md](docs/部署指南.md)**（Ubuntu 22.04 + 安装 Docker + 部署 + HTTPS + 安全 + 运维）。

微信认证、支付开通到提审发布的逐项操作见 **[docs/小程序发布执行清单.md](docs/小程序发布执行清单.md)**。

项目进度、关键决策与后续待办见 **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)**。

最新发布风险与优化优先级见 **[docs/发布前全面复盘-2026-08-29.md](docs/发布前全面复盘-2026-08-29.md)**。

分批实施进度见 **[docs/发布前优化排期.md](docs/发布前优化排期.md)**。

电脑端管理后台的独立建设方案见 **[docs/电脑端管理后台规划.md](docs/电脑端管理后台规划.md)**。

**服务器上执行：**

```bash
git clone git@github.com:zitangkou/coffee-order.git && cd coffee-order
./deploy.sh                      # 自动生成安全配置、安装 Docker、构建并启动
```

完成后访问：

- 公网 API/图片：由宿主机 Nginx 通过 `https://nagacoffee.site` 转发
- 商家后台：`https://nagacoffee.site/#/pages_admin/login/index`（首次登录后立即修改初始密码）

**说明**

- 部署脚本会自动生成强密钥、应用版本化 migration、初始化数据、验证 readiness，并安装备份与监控任务。
- DNS 和证书邮箱准备好后执行 `./deploy.sh --with-https`，可同时完成宿主机 Nginx 与 Let's Encrypt。
- 初始管理员凭据只保存在服务器 `var/initial-admin-credentials.txt`，首次改密后应删除。
- 腾讯云服务器若拉镜像慢，在 `.env` 里加 `DOCKER_MIRROR=mirror.ccs.tencentyun.com` 再执行 `./deploy.sh`。
- 桌码地址由 `WEB_BASE_URL` 控制，部署后先在商家后台「桌台管理」重新生成桌码再打印。
- 常用运维：`docker compose logs -f server`、`docker compose restart`、`git pull && ./deploy.sh`。
- 数据库与上传文件每日备份、每周恢复验证和运行监控分别由 `deploy/install-backup.sh`、`deploy/install-monitor.sh` 安装。

### 备选：传统部署（不使用 Docker）

1. 将 `server/prisma/schema.mysql.prisma` 覆盖为 `schema.prisma`，`DATABASE_URL` 改为 MySQL 连接串。
2. 启动 MySQL：`cd server && docker compose up -d mysql`（或使用已有 MySQL）。
3. `npx prisma db push && npm run seed`。
4. 使用 PM2 运行后端：`pm2 start ecosystem.config.js`；前端构建后由 Nginx 托管（见 `deploy/nginx.conf`）。
5. 正式环境通过 `VITE_API_BASE` 注入后端地址后构建 H5。

## 默认功能

- 顾客端：扫码进入（桌码/外带码）、分类菜单、规格定制（杯型/温度/奶/浓度/加料）、购物车、下单、模拟支付、取餐码、订单状态、退款申请。
- 商家端：登录、经营看板、订单工作台（接单/出餐/完成）、退款审核、商品与分类管理（售罄开关）、桌台与二维码、数据统计（日/周/月营收、热销、时段）、系统设置。
- 双端：同一份代码编译 H5 与微信小程序；真实微信登录、JSAPI 支付/查单/关单、原路退款/回调/同步和订阅消息均已具备代码闭环，待资质与生产环境就绪后真机联调。

> 说明：本地开发默认 SQLite 是为了零依赖开箱即跑；生产环境按文档走 MySQL 8，业务代码无需改动。
