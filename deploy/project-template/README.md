# 新项目接入模板（方案 B：域名网关 + 内网端口）

把本目录复制为新项目目录，按下面步骤改造即可，与 coffee-order 互不干扰。

## 使用步骤

1. 复制目录并改名：

```bash
cp -r deploy/project-template /opt/project-b
cd /opt/project-b
```

2. 改 compose 项目名（docker-compose.yml 顶部的 `name:`）与端口/库名。
3. 复制环境变量并修改：

```bash
cp .env.example .env && nano .env
```

4. 把 `app/` 里的示例页面替换成你的真实应用（见 `app/Dockerfile`）。
5. 部署：

```bash
docker compose up -d --build
```

6. 配置宿主机 Nginx 网关（参考 `nginx-site.conf.example`），域名解析到服务器后：

```bash
cp nginx-site.conf.example /etc/nginx/sites-available/project-b
ln -s /etc/nginx/sites-available/project-b /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

7. 备案完成后配置 HTTPS：`certbot --nginx -d b.example.com`

> 首次使用前确保已执行过一次 `deploy/setup-docker.sh`（Docker 与镜像源初始化）。
