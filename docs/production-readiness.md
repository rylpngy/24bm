# 24Bid 生产化就绪清单

方向 A(质量与生产化收口)产出。配套:E2E(`e2e/`)、可观测性(`infra/observability/`)、压测(`scripts/loadtest.mjs`)。

## 1. 配置与密钥外置

后端 `application.yml` 全部敏感项走 `${ENV:default}`,生产以环境变量覆盖,样例见根 `.env.example`:

| 变量 | 用途 | 生产要求 |
|---|---|---|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | 数据库 | 必填 |
| `JWT_SECRET` | 自研 JWT(开发后备登录) | ≥32 字节,必改(默认 `change-me-in-non-local-environments`) |
| `KEYCLOAK_JWK_SET_URI` | OIDC 主登录验签 | 指向生产 Keycloak |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | 对象存储 | 必填 |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 管理员 | 必改 |

## 2. 可观测性(`infra/observability/`)

后端经 Actuator + micrometer 暴露 `/actuator/prometheus`。一键起监控栈:

```bash
cd infra && docker compose --profile observability up -d
# Prometheus :9090   Grafana :3001(admin / $GRAFANA_ADMIN_PASSWORD)
```

- `prometheus.yml` —— 抓 `app:8080/actuator/prometheus`(15s)。
- `alert-rules.yml` —— 实例宕机 / 5xx>5% / P95>1.5s / 堆>90% 四条告警。
- Grafana 自动 provision 数据源 + 看板「24Bid 后端可观测性」(吞吐 / 错误率 / P95·P99 延迟 / JVM 堆)。

## 3. 压测基线(`scripts/loadtest.mjs`)

```bash
node scripts/loadtest.mjs 500 20   # 总请求 / 并发
```

本机基线(7 个只读端点,500 请求 / 并发 20,后端单实例本地):

| 指标 | 值 |
|---|---|
| 吞吐 | ~940 req/s |
| 错误 | 0 |
| 延迟 | p50 11ms · p95 69ms · p99 112ms |

> 作为回归对比基线;接入生产规模数据后重测并更新。

## 4. 端到端测试(`e2e/`,Playwright)

```bash
pnpm e2e   # 复用本地三端 dev + 后端 :8080
```

8 个用例覆盖三端:采购主链路深走(需求→询价→报价对比→订单→发票)+ 三端列表/工具条冒烟。

## 5. CI(`.github/workflows/verify.yml`)

三 job:`backend`(mvn verify)、`frontend`(typecheck + vitest)、`e2e`(起 postgres+后端+三端 dev,跑 Playwright,上传报告)。

## 6. 待办(后续)

- 告警接收端(Alertmanager → 邮件/钉钉/企微)。
- 生产部署清单(K8s/compose 镜像、滚动发布、备份恢复演练)。
- 压测扩展到写路径与峰值并发。
