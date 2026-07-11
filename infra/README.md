# 24Bid 一键部署(docker compose)

全栈自托管开源件,单机 docker compose 即可拉起完整环境:PostgreSQL + Redis + MinIO + Keycloak + 后端 + 三端前端(+ 可选可观测性)。

## 快速开始

```bash
cd infra
cp .env.example .env          # 按环境改密码与对外地址
docker compose --profile app --profile portals up -d --build
```

首次构建约 5-10 分钟(Maven/pnpm 依赖拉取)。完成后:

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| 采购方门户 | http://localhost:5173 | tenant-portal |
| 平台运营后台 | http://localhost:5174 | platform-admin |
| 供应商门户 | http://localhost:5175 | supplier-portal |
| 后端 API | http://localhost:8080 | Spring Boot,`/actuator/health` 健康检查 |
| Keycloak | http://localhost:8081 | 管理台 admin/admin(启动时自动导入 24bid realm)|
| MinIO 控制台 | http://localhost:9001 | 附件对象存储 |

演示账号(db/demo 种子 + Keycloak realm 导入):`buyer.owner@example.com` 等,密码 `demo123456`。

## 分层启动

- 只要基础设施(本地开发,后端/前端跑在宿主机):`docker compose up -d`
- 基础设施 + 后端:`docker compose --profile app up -d --build`
- 加可观测性(Prometheus/Alertmanager/Grafana):追加 `--profile observability`

## 试点环境要点

1. **改默认凭据**:`.env` 中 `DB_PASSWORD` / `MINIO_ROOT_PASSWORD` / `GRAFANA_ADMIN_PASSWORD`,以及 Keycloak 管理员密码(首次登录管理台修改)。
2. **安全基线**:`ALLOW_DEMO_JWT_SECRET=false`、`SELF_LOGIN_ENABLED=false`、`VITE_SELF_LOGIN=false`,`CORS_ALLOWED_ORIGINS` 改为实际访问地址。
3. **对外地址**:`PUBLIC_API_URL` / `PUBLIC_KEYCLOAK_URL` 必须是浏览器可达的地址(如 `https://api.example.com`),前端为构建期注入,改后需 `--build` 重建前端镜像。
4. **干净数据库**:`SPRING_FLYWAY_LOCATIONS=classpath:db/migration`(去掉 demo 种子);基础数据用三端内置的 Excel 批量导入(物料/部门/供应商邀请)初始化。
5. **备份**:数据卷为 `24bid-postgres-data` / `24bid-minio-data`。PostgreSQL 逻辑备份:
   ```bash
   docker exec 24bid-postgres pg_dump -U procurement procurement_saas | gzip > backup-$(date +%F).sql.gz
   ```
   恢复演练步骤见 `docs/pilot-operations-handoff-2026-07.md`。
6. **告警**:`observability/alertmanager.yml` 配置真实接收人(邮箱/webhook)后重启 alertmanager。

## 常见问题

- **前端登录报 Keycloak 失败**:确认 `PUBLIC_KEYCLOAK_URL` 浏览器可达、realm 已导入(keycloak 容器日志含 `Imported realm 24bid`)。
- **后端起不来**:`docker logs 24bid-app`;最常见是数据库未就绪(compose 已用 healthcheck 串联)或 Flyway 校验失败(库与迁移不一致时需重建卷)。
- **改了 .env 前端不生效**:VITE_* 是构建期变量,需 `docker compose --profile portals up -d --build` 重建。
