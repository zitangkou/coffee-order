# Coffee OS Docker 一键部署

适用环境：腾讯云轻量应用服务器、Ubuntu 22.04/24.04、4 核 4G。公网仅开放 SSH、80、443；MySQL、API 和容器 Web 端口不得直接暴露。

## 最简部署

```bash
git clone git@github.com:zitangkou/coffee-order.git
cd coffee-order
./deploy.sh
```

首次执行会自动：

1. 创建权限为 `600` 的 `.env`。
2. 生成 MySQL 用户密码、MySQL root 密码、JWT 密钥和一次性管理员密码，生成值不会打印到终端。
3. 缺少 Docker 时自动安装 Docker Engine 与 Compose。
4. 校验配置、磁盘空间和 Docker daemon。
5. 构建非 root API/Web 镜像，启动 MySQL，执行版本化 migration。
6. 初始化基础数据并自动关闭重复初始化开关。
7. 等待 MySQL、API、数据库 readiness 和 Web 全部健康。
8. 备份数据库与上传文件，安装每日备份、每周恢复验证和每 5 分钟监控。

如果脚本是以普通用户首次安装 Docker，会将当前用户加入 `docker` 组并安全退出；重新登录服务器后再次执行 `./deploy.sh` 即可从预检阶段继续，不会重复初始化数据。

初始管理员凭据只保存在服务器的 `var/initial-admin-credentials.txt`，权限为 `600`。首次登录并修改密码后应删除该文件。

## 同时配置 HTTPS

确保 `nagacoffee.site` 已解析到服务器公网 IP，腾讯云安全组和 UFW 已放行 80/443。先生成配置并填写证书通知邮箱：

```bash
bash deploy/init-config.sh
nano .env
./deploy.sh --with-https
```

只需补充 `LETSENCRYPT_EMAIL`；数据库/JWT/初始管理员密码已经安全生成，无需手工改写。脚本会安装宿主机 Nginx/Certbot、申请证书、配置续期和 HTTPS 反向代理，并验证公网 readiness。

## 更新与重跑

```bash
git pull
./deploy.sh
```

重复部署会在构建新版本前自动备份正在运行的数据库和上传文件。migration、seed、cron 安装和配置更新均按幂等方式执行。

可用参数：

- `--with-https`：配置或续用宿主机 HTTPS 网关。
- `--skip-build`：仅使用已有镜像重启，适合排障；正常更新不要使用。

## 验证与排障

```bash
docker compose ps
curl -fsS http://127.0.0.1:8080/api/health/ready
bash deploy/security-check.sh
bash deploy/restore-verify.sh
bash deploy/monitor.sh
```

在服务器本机之外用 `127.0.0.1:8080` 方式调试管理后台时，需要把该本地地址加入 `.env` 的 `CORS_ORIGINS`；线上服务器仍只保留正式 HTTPS 域名。

部署脚本失败时不会自动打印应用日志，避免日志意外包含业务信息。按提示手动查看必要范围：

```bash
docker compose logs --tail=100 server
docker compose logs --tail=100 mysql
```

微信 AppSecret、支付密钥和证书继续只放服务器受控配置/`secrets/`，不要提交 Git，也不要粘贴到会话中。证书文件需确保容器 UID 1000 只读可访问。

## 服务器外部待办

- 腾讯云安全组：仅放行 SSH、80、443。
- UFW：仅放行必要端口。
- 将 `var/backups` 同步到腾讯云 COS；同机 40G 系统盘不是完整灾备。
- 将 `var/log/monitor.log` 中的失败接入腾讯云日志服务或云监控告警。
- 微信认证/支付开通后再注入微信配置并做真机资金链路验收。
