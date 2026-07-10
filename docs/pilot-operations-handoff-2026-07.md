# 24Bid Pilot Operations Handoff

> Updated: 2026-07-01
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

