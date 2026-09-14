# 鲁东大学 POC 生产交付包设计

## 目标

为鲁东大学采购申报 POC 提供一套独立于现有开发环境的最小化 Docker Compose 交付方案。本地完成镜像构建、完整启动验证和干净数据初始化后，将固定版本镜像、Compose 文件、相对目录数据快照和生产 Nginx 示例打成一个目录包。生产服务器解压、加载镜像并启动即可，不需要源码、Maven、Node.js 或联网构建。

## 范围

交付包只包含手册实际使用的运行面：

- `tenant-portal`，通过 `?solution=ludong-poc` 进入鲁东 POC。
- Spring Boot 后端。
- PostgreSQL 16，保存业务、身份、流程和附件元数据。
- MinIO，保存材料台账附件和完整归档包依赖的对象。

不包含 Redis、Keycloak、`supplier-portal`、`platform-admin`、`mall-portal` 和可观测性组件。鲁东 POC 使用后端自签登录接口和手册中的工号、密码；后端关闭 Keycloak 验签入口，开启 POC 自签登录。

## 目标平台

- 构建机：Linux `amd64`，已确认 Docker 服务端为 `linux/amd64`。
- 生产机：Linux `amd64`。
- Docker Engine 与 Docker Compose v2 可用。
- PostgreSQL 物理目录只与交付包固定的 PostgreSQL 镜像版本配套使用，不允许替换主版本后直接挂载旧目录。

## 目录结构

源码仓库新增 `infra/ludong-poc-prod/`：

```text
infra/ludong-poc-prod/
├── docker-compose.prod.yml
├── docker-compose.build.yml
├── Dockerfile.portal
├── portal-nginx.conf
├── .env.example
├── README.md
├── build-and-test.sh
├── prepare-clean-data.sh
├── pack.sh
├── start.sh
├── nginx/
│   └── 24bid-ludong.conf.example
├── images/
└── data/
    ├── postgres/
    └── minio/
```

`images/` 和 `data/` 的运行产物不提交 Git；目录通过占位文件和忽略规则保留。最终交付压缩包包含运行时生成的镜像归档及干净数据目录。

## Compose 分层

### 生产基础文件

`docker-compose.prod.yml` 只声明 `image:`，不得包含源码构建要求。服务包括：

- `postgres`：固定 PostgreSQL 16 小版本镜像，绑定 `./data/postgres:/var/lib/postgresql/data`。
- `minio`：固定 MinIO 版本镜像，绑定 `./data/minio:/data`。
- `app`：固定名称的鲁东后端业务镜像，仅加入 Compose 内网，不发布宿主机端口。
- `portal`：固定名称的鲁东前端业务镜像，仅绑定 `127.0.0.1:${PORTAL_PORT}:80`。

所有服务使用 `restart: unless-stopped`。PostgreSQL 配置健康检查；后端等待 PostgreSQL 健康并使用自身 readiness 健康检查；门户等待后端启动。数据库、MinIO 和后端均不设置宿主机 `ports`。

### 本地构建覆盖文件

`docker-compose.build.yml` 只在源码仓库中使用，为 `app` 和 `portal` 增加 `build:`。本地构建命令同时加载生产基础文件和构建覆盖文件。本地验证完成后，生产只携带并使用基础文件。

后端沿用 `backend-java/Dockerfile`。门户使用专用 `Dockerfile.portal` 构建 `tenant-portal`，运行层使用专用 `portal-nginx.conf`。

## 请求链路

浏览器只访问门户入口：

```text
浏览器 -> 宿主机 Nginx :80/:443 -> 127.0.0.1:5173 -> portal
                                                        └─ /api/* -> app:8080
```

门户构建时 API 基地址使用同源地址。门户容器内 Nginx：

- `/assets/` 使用长期缓存。
- `/api/` 代理到 `http://app:8080`，保留请求体和转发头。
- 其他路径使用 SPA `index.html` 回退。

因此本地可以直接访问 `http://127.0.0.1:5173/?solution=ludong-poc`，生产宿主机 Nginx 也只需把站点整体代理到回环地址 `127.0.0.1:5173`。

## 生产 Nginx 示例

交付包包含宿主机 Nginx 示例，具备：

- 80 端口 HTTP 服务及可选的 HTTPS 跳转写法。
- 443 端口 TLS 服务、证书路径占位示例和现代 TLS 基线。
- `client_max_body_size`，满足材料附件上传。
- WebSocket/SSE 兼容代理头、真实客户端地址和 `X-Forwarded-*` 头。
- 全站代理到 `127.0.0.1:5173`。

生产防火墙只开放 TCP 80 和 443。5173 只绑定回环地址；8080、5432、9000 和 9001 不监听宿主机公网接口。

## 配置与演示身份

环境模板明确设置：

- `APP_SEED_LOCATIONS=classpath:db/poc/ludong`
- `SELF_LOGIN_ENABLED=true`
- `KEYCLOAK_ENABLED=false`
- `ALLOW_DEMO_JWT_SECRET=true`
- 固定的 POC 数据库名和数据库用户
- 可修改的数据库密码、MinIO 凭据、JWT 密钥和门户回环端口

种子数据必须生成手册中的租户 `tenant-ludong-poc`、工号 `LDU000001`、`LDU100001`、`LDU200000` 至 `LDU200017`，所有演示账号密码为 `demo123456`。最终验收至少检查管理员、申报人和一个审批人可登录，且管理员能看到鲁东 POC 的初始项目与流程配置。

## 数据目录与迁移

PostgreSQL 和 MinIO 使用相对于 `docker-compose.prod.yml` 的绑定目录。物理快照打包必须遵循以下顺序：

1. 在专用交付目录中清空旧的 POC 数据目录。
2. 启动固定版本 PostgreSQL、MinIO 和后端，让 Flyway 应用正式迁移及 `classpath:db/poc/ludong` 种子。
3. 验证种子账号、流程和初始业务数据。
4. 停止全部容器，确认 PostgreSQL 已正常退出。
5. 使用保留 UID、GID、权限和符号链接的 tar 方式打包整个交付目录。

禁止在 PostgreSQL 或 MinIO 容器运行期间复制其数据目录。`prepare-clean-data.sh` 是破坏性操作，只能删除 `infra/ludong-poc-prod/data/postgres` 和 `infra/ludong-poc-prod/data/minio`，并要求显式确认参数；不得接受任意目标路径。

本地业务走查会改变项目、任务、审计和附件数据。因此用于生产交付的数据必须在走查结束后重新执行干净初始化，不得直接打包走查后的数据目录。

## 镜像交付

`pack.sh` 在容器全部停止后：

1. 校验目标平台为 `linux/amd64`。
2. 校验四个固定镜像均存在。
3. 使用 `docker save` 将门户、后端、PostgreSQL 和 MinIO 镜像写入 `images/24bid-ludong-amd64.tar`。
4. 校验数据目录存在且 PostgreSQL 不在运行。
5. 在交付目录上级生成带版本号的 `.tar.gz`，保留文件所有权和权限。

生产 `start.sh`：

1. 校验 Docker、Compose、架构、环境文件、镜像归档和数据目录。
2. `docker load` 导入镜像。
3. 执行 `docker compose --env-file .env -f docker-compose.prod.yml up -d`。
4. 等待 PostgreSQL、后端和门户健康，并输出本机验证 URL。

脚本不得在生产执行 `docker compose build`，不得依赖源码目录，也不得自动修改宿主机 Nginx 或防火墙。

## 安全边界

- `.env` 不提交 Git；只提供 `.env.example`。
- POC 自签登录只用于此次演示交付，手册也明确正式上线需接入统一认证。
- PostgreSQL、MinIO 和后端只在 Compose 内网访问。
- 门户只绑定回环地址。
- Nginx TLS 私钥不进入交付包，示例只提供路径。
- 打包脚本不会收集仓库中的其他 `.env`、Git 数据或客户资料。

## 验证标准

自动验证包括：

- 两个 Compose 文件合并后可通过 `docker compose config`。
- 生产基础 Compose 单独解析时没有 `build:`。
- 只有门户发布端口，且绑定 `127.0.0.1`。
- PostgreSQL 和 MinIO 使用相对绑定目录。
- 配置中没有 Redis、Keycloak 或其他门户服务。
- 门户镜像构建成功，后端镜像构建成功。
- 四个容器启动，健康检查通过。
- `/?solution=ludong-poc` 返回前端页面。
- 通过反向代理的 `/api/v1/health` 返回成功。
- 使用 `LDU000001`、`LDU100001` 和 `LDU200001` 加 `demo123456` 登录成功。
- 数据库查询确认 `tenant-ludong-poc`、演示工号、已发布流程和 POC 初始项目存在。
- 上传一个临时附件后可以下载，以验证 MinIO 链路；随后重新执行干净初始化，保证交付快照不含验证附件。
- 停止容器后可以生成镜像 tar 和最终交付压缩包。
- 从最终交付压缩包解压到新的临时目录后，无源码执行 `start.sh` 可以再次启动并通过核心冒烟。

## 不在本次范围

- Kubernetes、镜像仓库发布和自动更新。
- 自动签发 TLS 证书。
- 自动修改生产防火墙。
- Keycloak 或鲁东大学统一身份认证集成。
- PostgreSQL 跨主版本升级。
- 多机高可用、对象存储集群和数据库主从复制。
