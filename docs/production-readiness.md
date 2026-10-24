# 24Bid 生产化就绪清单

方向 A(质量与生产化收口)产出。配套:E2E(`e2e/`)、可观测性(`infra/observability/`)、压测(`scripts/loadtest.mjs`)。

Pilot 前的真实接收人、备份恢复演练和生产策略签核记录统一填写到 `docs/pilot-operations-handoff-2026-07.md`。该文件只保留非密模板和证据链接,真实 webhook、密钥、账号、值班联系人必须存放在客户侧受控系统。

## 1. 配置与密钥外置

后端 `application.yml` 全部敏感项走 `${ENV:default}`,生产以环境变量覆盖,样例见根 `.env.example`:

| 变量 | 用途 | 生产要求 |
|---|---|---|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | 数据库 | 必填 |
| `JWT_SECRET` | 自研 JWT(开发后备登录) | ≥32 字节,必改(默认 `change-me-in-non-local-environments`) |
| `ALLOW_DEMO_JWT_SECRET` | 演示 JWT 密钥回退开关 | 生产必须 `false`:`JWT_SECRET` 缺失或仍为占位时启动即失败 |
| `SELF_LOGIN_ENABLED` | 自研 JWT 签发(`/auth/login`) | 生产必须 `false`,Keycloak 为唯一签发方 |
| `TENANT_HEADER_FALLBACK_ENABLED` | 无 Bearer 时信任 `X-Tenant-Id` 等请求头(旧原型兼容) | 默认已关闭;生产禁止开启 |
| `CORS_ALLOWED_ORIGINS` | CORS 来源白名单(逗号分隔) | 生产必填真实前端域名;默认值仅本地 dev 端口 |
| `KEYCLOAK_JWK_SET_URI` | OIDC 主登录验签 | 指向生产 Keycloak |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | 对象存储 | 必填 |
| `AWARD_NOTICE_SIGNATURE_SECRET` | 中标通知书电子签章 HMAC 密钥 | ≥32 字节,必填;生产启动参数建议加 `-Dprocurement.award-notice.allow-demo-secret=false` 禁用演示密钥 |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 管理员 | 必改 |

## 2. 可观测性与告警(`infra/observability/`)

后端经 Actuator + micrometer 暴露 `/actuator/prometheus`。一键起监控栈:

```bash
cd infra && docker compose --profile observability up -d
# Prometheus :9090   Alertmanager :9093   Grafana :3001(admin / $GRAFANA_ADMIN_PASSWORD)
```

- `prometheus.yml` —— 抓 `app:8080/actuator/prometheus`(15s)。
- `alert-rules.yml` —— 实例宕机 / 5xx>5% / P95>1.5s / 堆>90% 四条告警。
- `alertmanager.yml` —— 本地默认投递到 `host.docker.internal:9094`;生产替换为邮件、钉钉/企微 adapter 或内部值班平台,不要提交真实 webhook 密钥。
- Grafana 自动 provision 数据源 + 看板「24Bid 后端可观测性」(吞吐 / 错误率 / P95·P99 延迟 / JVM 堆)。

生产接收人绑定要求:

1. 在生产环境通过 overlay 或部署侧配置替换 Alertmanager receiver,不要修改并提交真实 webhook。
2. `critical` 至少绑定一线值班角色和二线升级角色;`warning` 至少绑定后端负责人或平台负责人。
3. 用一条合成告警验证发送和恢复通知,证据链接记录到 `docs/pilot-operations-handoff-2026-07.md`。
4. 告警无人确认或接收渠道无法回放时,不得进入 pilot 数据导入。

## 3. 压测基线

```bash
# 显式授权目标并通过部署侧密钥系统注入 LOADTEST_TOKEN；脚本不再自动演示账号登录。
LOADTEST_AUTHORIZED=true LOADTEST_BASE_URL=http://127.0.0.1:8095 node scripts/loadtest.mjs 500 20
node scripts/loadtest-write-paths.mjs 3 1   # 完整写流程数 / 并发
```

只读压测默认每请求10秒超时、错误率阈值0、P95阈值1500ms；可通过`LOADTEST_TIMEOUT_MS`、`LOADTEST_MAX_ERROR_RATE`、`LOADTEST_MAX_P95_MS`显式设置。HTTP失败、业务信封失败、非JSON及网络错误均计失败，整体或任一端点超阈值退出非零。`LOADTEST_REPORT`可指定全新JSON报告路径，不覆盖旧报告；报告不保存令牌。运行`pnpm test:operations`验证工具。禁止未经确认向原系统执行压力或写路径测试。

历史本机基线（旧版本脚本，未按当前版本重验，不能作为当前容量承诺；7个只读端点，500请求/并发20）：

| 指标 | 值 |
|---|---|
| 吞吐 | ~940 req/s |
| 错误 | 0 |
| 延迟 | p50 11ms · p95 69ms · p99 112ms |

> 作为回归对比基线;接入生产规模数据后重测并更新。

写路径基线脚本 `scripts/loadtest-write-paths.mjs` 会按受控循环创建需求、审批、RFQ、供应商报价、定标、订单、发货、收货、发票和付款申请。默认流程数为 3、并发为 1,用于发布前低风险回归;提高并发前需确认使用隔离测试库。

## 4. 端到端测试(`e2e/`,Playwright)

```bash
pnpm e2e   # 复用本地三端 dev + 后端 :8080
```

覆盖采购主链路及各端关键流程；当前数量以实际CI报告为准，不以历史文档中的数量作为验收证据。默认E2E会写业务数据，只能指向隔离验收环境。

## 5. CI(`.github/workflows/verify.yml`)

三 job:`backend`(mvn verify)、`frontend`(typecheck + vitest)、`e2e`(起 postgres+后端+三端 dev,跑 Playwright,上传报告)。

## 6. 生产部署清单

### 6.1 镜像与配置

1. 在发布分支执行 `npm run verify`,确认 OpenAPI、前端、后端测试全部通过。
2. 构建后端镜像:`docker compose -f infra/docker-compose.yml --profile app build app`。
3. 生产环境必须注入第 1 节所有敏感变量;禁止使用 `.env.example` 中的占位值。
4. 生产启动建议增加 `-Dprocurement.award-notice.allow-demo-secret=false`,确保中标通知书签章不会回退演示密钥。
5. Keycloak、MinIO、PostgreSQL、Redis 均使用自托管实例或私有化托管实例,不得依赖本地默认账号密码。

### 6.2 发布顺序

1. 备份 PostgreSQL 与 MinIO 桶元数据。
2. 先在备份副本验证最终产物的Flyway迁移及原数据摘要；正式迁移失败立即停止发布，保存数据库、日志与迁移状态，不直接启动旧镜像，不repair/clean，不自动恢复覆盖原数据。
3. 启动后端新版本,等待 `/api/v1/health` 与 `/actuator/prometheus` 可访问。
4. 启动三端前端静态资源或网关路由。
5. 运行冒烟:登录采购方、打开需求/RFQ/合同/付款批次、执行一个只读查询、验证 Grafana 有新指标。
6. 发布后观察 30 分钟:实例宕机、5xx、P95、JVM 堆四类告警必须为绿色。

### 6.3 回滚与恢复

1. 保留上一个后端镜像 tag 与前端静态资源包。
2. 如果发布后出现不可接受的5xx或核心流程阻断，先停止新增写入并保存当前数据库、附件和日志；核实旧应用与新数据库结构的兼容性后，才制定应用回退方案。
3. 数据库恢复必须明确停机窗口、发布后新增数据处置和数据丢失边界，经确认后执行；优先在新隔离目标演练，不允许自动恢复覆盖原库。
4. 每次生产发布后记录:镜像 tag、迁移版本、操作者、开始/结束时间、冒烟结果、是否触发告警。

### 6.4 备份演练

1. PostgreSQL:每日全量备份,关键发布前手动备份;每月至少演练一次恢复到临时库。
2. MinIO:每日对象与元数据备份;抽样验证合同附件、发票附件、中标通知书 PDF 可恢复。
3. Keycloak:发布前导出 realm 配置;权限/角色调整后补充导出。
4. 演练通过标准:临时环境可登录、可读取采购主链路列表、可打开至少一个附件。
5. 每次演练必须记录 operator、backup id、restore target、start/end time、smoke result 和 rollback notes,并把证据链接写入 `docs/pilot-operations-handoff-2026-07.md`。

### 6.5 生产策略签核

Pilot 数据导入前,以下策略必须有客户侧或部署侧证据链接:

| 策略 | 最低要求 |
|---|---|
| Keycloak realm | realm/client/redirect URI/token TTL/管理员 owner 明确;保留紧急访问路径 |
| MinIO bucket | bucket/访问策略/加密/生命周期/保留周期明确 |
| PostgreSQL backup | 备份频率、保留周期、加密、异地副本、RTO/RPO 明确 |
| Secret rotation | JWT、数据库、MinIO、Grafana、Keycloak client secret、中标通知书签章密钥都有轮换周期和 owner |

## 7. 待办(后续)

- 接入生产规模脱敏数据后重新记录读写路径压测基线。
- 扩展峰值并发场景与长稳压测。
