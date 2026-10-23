# 鲁东大学采购申报 POC 离线部署

本目录只部署《鲁东大学采购申报POC演示与操作手册》涉及的采购人门户：

- 前端：`apps/tenant-portal`，固定入口 `/?solution=ludong-poc`
- 后端：Spring Boot API
- 基础服务：PostgreSQL、MinIO
- 不部署 Redis、Keycloak、供应商门户、平台管理端和商城

宿主机只在回环地址 `127.0.0.1:5173` 暴露门户。PostgreSQL、MinIO 和后端仅在 Docker 内部网络通信；生产由宿主机 Nginx 对外开放 80/443。

## 一、本地构建并实际验证

运行环境：Linux amd64、Docker Engine、Docker Compose v2、curl、Python 3。先进入本目录：

```bash
cp .env.example .env
# 检查并按需修改 .env；正式生产务必更换其中三个密码/密钥
./build-and-test.sh
```

脚本会最小化构建后端和采购人门户镜像，启动全部四个容器，并自动验证：

- 页面 `http://127.0.0.1:5173/?solution=ludong-poc` 可访问
- 后端健康接口可访问
- 手册中的三类账号可登录：`LDU000001`、`LDU100001`、`LDU200001`
- 三个账号初始密码均为 `demo123456`

随后请在浏览器按操作手册人工走查。若要改本机入口端口，可修改 `.env` 中的 `PORTAL_PORT`。

## 二、恢复与手册一致的干净数据

人工测试会改变申请状态或产生附件。打包前必须明确执行一次破坏性重置：

```bash
./prepare-clean-data.sh --confirm-reset-ludong-poc
```

该脚本只清空本目录下的 `data/postgres` 和 `data/minio`，重新启动服务生成鲁东 POC 初始数据，验证租户、三类工号和初始申报项目，然后停止容器。不要手工复制正在运行的 PostgreSQL 物理目录。

## 三、生成离线交付包

```bash
./pack.sh
```

只有同时存在“本地启动验证通过”和“干净数据快照通过”标记时才允许打包。输出内容：

- `24bid-ludong-poc-<版本>.tar.gz`
- 同名 `.sha256` 校验文件

压缩包内含四个 Linux amd64 镜像、Compose 文件、启动脚本、Nginx 示例，以及 PostgreSQL/MinIO 相对目录数据。生成后建议先在另一临时目录解压并执行下一节的生产启动流程，完成一次离线包复验。

## 四、生产服务器启动

生产服务器只需 Linux amd64、Docker Engine 和 Docker Compose v2，无需源码、Node.js、Java 或外网：

```bash
sha256sum -c 24bid-ludong-poc-<版本>.tar.gz.sha256
tar xzf 24bid-ludong-poc-<版本>.tar.gz
cd 24bid-ludong-poc-<版本>
cp .env.example .env
# 修改 .env 中 DB_PASSWORD、MINIO_ROOT_PASSWORD、JWT_SECRET
./start.sh
```

检查：

```bash
docker compose --env-file .env -f docker-compose.prod.yml ps
curl -f 'http://127.0.0.1:5173/?solution=ludong-poc'
curl -f 'http://127.0.0.1:5173/api/v1/health'
```

停止服务但保留数据：

```bash
docker compose --env-file .env -f docker-compose.prod.yml down
```

不要加 `-v`，也不要删除 `data/`。当前部署使用相对绑定目录，整个解压目录不可在服务运行时移动。

## 五、生产 Nginx 与端口

参考 `nginx/24bid-ludong.conf.example`：

1. 将示例复制到宿主机 Nginx 的 `conf.d`。
2. 替换 `server_name`；若启用 HTTPS，再替换证书路径。
3. 暂时只用 HTTP 时，注释示例中的整个 443 `server`。
4. 执行 `nginx -t`，通过后 reload。
5. 防火墙仅允许外部访问 80/443；不要开放 5173、8080、5432、9000、9001。

Nginx 和 Docker 必须位于同一宿主机，因为上游固定为 `127.0.0.1:5173`。

## 六、数据备份

建议停止服务后备份整个交付目录，至少包含：

- `data/postgres/`
- `data/minio/`
- `.env`

恢复时应使用同一交付版本的镜像和 Compose 文件。PostgreSQL 目录是物理数据目录，不应跨 PostgreSQL 大版本直接复用；备份和复制期间必须保持容器停止。
