# 24Bid Pilot Operations Handoff

> Updated: 2026-07-11
> Scope: production-like pilot operations evidence that must be filled outside the repository with real environment values.

This document is the handoff ledger for the remaining Track A productionization work. Do not commit real webhook URLs, passwords, access keys, backup locations, or private escalation contacts. Store real values in the customer's secret manager, incident platform, or controlled operations workspace.

## 1. Alert Routing Registry

| Severity | Route | Owner role | Primary channel | Escalation window | Evidence location | Status |
|---|---|---|---|---|---|---|
| Critical | `BackendInstanceDown` | Platform on-call | Fill in production receiver outside repo | 15 minutes | Link to incident platform / Alertmanager receiver config | Pending environment binding |
| Warning | `HighHttp5xxRate` | Backend owner | Fill in production receiver outside repo | 30 minutes | Link to incident platform / Alertmanager receiver config | Pending environment binding |
| Warning | `HighRequestLatencyP95` | Backend owner | Fill in production receiver outside repo | 30 minutes | Link to incident platform / Alertmanager receiver config | Pending environment binding |
| Warning | `HighJvmHeapUsage` | Backend owner | Fill in production receiver outside repo | 30 minutes | Link to incident platform / Alertmanager receiver config | Pending environment binding |

Acceptance criteria:

1. `infra/observability/alertmanager.yml` is replaced or overlaid in production with a receiver that sends to email, DingTalk, WeCom, or the internal incident platform.
2. A synthetic alert is delivered to the primary channel and then resolved.
3. Critical alerts have a named owner role and a documented second-line escalation.
4. The evidence link above points to a screenshot, incident event, or receiver test log stored outside this repository.

## 2. Backup And Restore Rehearsal Record

| Asset | Backup source | Restore target | Minimum cadence | Latest rehearsal | Evidence location | Status |
|---|---|---|---|---|---|---|
| PostgreSQL | Production-like database backup | Temporary PostgreSQL instance | Monthly and before major releases | Not yet recorded | Fill outside repo | Pending rehearsal |
| MinIO | Attachment bucket and metadata backup | Temporary MinIO bucket | Monthly and before major releases | Not yet recorded | Fill outside repo | Pending rehearsal |
| Keycloak | Realm export | Temporary Keycloak realm | Before auth/role changes and releases | Not yet recorded | Fill outside repo | Pending rehearsal |

Restore pass criteria:

1. The temporary environment starts with restored PostgreSQL, MinIO, and Keycloak data.
2. A buyer user can log in through Keycloak/OIDC.
3. Buyer demand, RFQ, contract, and payment-batch lists load with the expected tenant scope.
4. At least one restored attachment opens successfully.
5. The rehearsal record includes operator, start/end time, source backup id, target environment, smoke result, and rollback notes.

## 3. Production Policy Checklist

| Policy | Required decision | Evidence location | Status |
|---|---|---|---|
| Keycloak realm | Realm name, client ids, redirect URIs, token TTL, admin owner, emergency access path | Fill outside repo | Pending |
| MinIO bucket | Bucket name, retention policy, encryption policy, access policy, lifecycle policy | Fill outside repo | Pending |
| PostgreSQL backup | Backup cadence, retention period, encryption, offsite copy, restore RTO/RPO | Fill outside repo | Pending |
| Secret rotation | Rotation cadence for JWT, MinIO, Grafana, award-notice signing, database, and Keycloak client secrets | Fill outside repo | Pending |

Minimum pilot policy:

1. All production secrets are injected from environment variables or a secret manager.
2. Demo defaults are disabled where supported, including `-Dprocurement.award-notice.allow-demo-secret=false`.
3. Secret rotation has an owner, a calendar cadence, and a rollback plan.
4. Backup retention and restore objectives are accepted by the pilot sponsor before pilot data is loaded.

## 4. Pilot Signoff Gate

Before loading pilot data, collect the following evidence:

| Gate | Command or evidence | Required result |
|---|---|---|
| Local verification | `npm run verify` | Exit 0 |
| Observability config | `docker compose -f infra/docker-compose.yml --profile observability config` | Exit 0 |
| Alert delivery | Synthetic alert event | Delivered and resolved in production channel |
| Backup restore | Temporary restore rehearsal | Pass criteria in section 2 satisfied |
| Secret hardening | Production runtime configuration | No demo secrets or default passwords |
| Role/data scope | Pilot org chart review | Buyer roles and data scopes approved |

## 5. 环境侧操作手册(Operator Runbook,2026-07-11 补)

以下为环境侧两项待办的具体操作步骤。一键部署与安全基线见 `infra/README.md` 与 `infra/.env.example`。

### 5.1 告警接收人绑定

1. 编辑 `infra/observability/alertmanager.yml`(生产环境用 overlay 或环境副本,不提交真实地址),把默认 receiver 换成真实通道,例如企业微信/钉钉 webhook:
   ```yaml
   receivers:
     - name: pilot-oncall
       webhook_configs:
         - url: <真实 webhook 地址,存放于密管>
   route:
     receiver: pilot-oncall
   ```
2. 重启告警组件:`docker compose -f infra/docker-compose.yml --profile observability up -d alertmanager`。
3. 发送合成告警验证送达:
   ```bash
   curl -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' -d \
     '[{"labels":{"alertname":"PilotSyntheticTest","severity":"critical"},"annotations":{"summary":"试点告警通道联通性测试"}}]'
   ```
4. 通道收到并确认后,在第 1 节表格回填 Evidence location 与 Status(截图/事件链接存密管或运维工作区)。

### 5.2 备份 / 恢复演练

备份(每月与大版本发布前):

```bash
# PostgreSQL 逻辑备份
docker exec 24bid-postgres pg_dump -U procurement procurement_saas | gzip > pg-$(date +%F).sql.gz
# MinIO 附件桶(mc 镜像同步到备份目录/异地桶)
docker run --rm --network host -v "$PWD/minio-backup:/backup" minio/mc sh -c \
  "mc alias set src http://localhost:9000 <ACCESS_KEY> <SECRET_KEY> && mc mirror src/24bid-attachments /backup"
# Keycloak realm 导出
docker exec 24bid-keycloak /opt/keycloak/bin/kc.sh export --dir /tmp/export --realm 24bid \
  && docker cp 24bid-keycloak:/tmp/export ./keycloak-export-$(date +%F)
```

恢复演练(临时环境,勿指向生产卷):

```bash
# 1. 起临时 Postgres 并灌入备份
docker run -d --name restore-pg -e POSTGRES_DB=procurement_saas -e POSTGRES_USER=procurement \
  -e POSTGRES_PASSWORD=procurement -p 15432:5432 postgres:16-alpine
gunzip -c pg-<日期>.sql.gz | docker exec -i restore-pg psql -U procurement procurement_saas
# 2. 后端指向临时库启动,冒烟四查(登录/需求/询比/付款批次列表)
DB_URL=jdbc:postgresql://localhost:15432/procurement_saas mvn -f backend-java spring-boot:run
# 3. 任取一附件确认可打开;记录操作人/起止时间/备份编号/冒烟结果,回填第 2 节表格
```

通过标准沿用第 2 节 Restore pass criteria;演练记录存运维工作区,表格中只放链接。

