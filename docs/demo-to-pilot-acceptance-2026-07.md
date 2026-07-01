# 24Bid Demo-To-Pilot Acceptance Package

> Updated: 2026-07-01
> Scope: separates customer-demo readiness, pilot readiness, and production blockers after the handoff governance pass.

## 1. Conclusion

24Bid is ready to continue as a Java-backed customer-demo and pilot-preparation baseline. It should not be represented as a fully production-ready procurement SaaS until the production blockers in section 4 are closed.

The next engineering direction remains Track A closeout: expand permission/data-scope enforcement across more list APIs, keep `npm run verify` green, and preserve clear evidence for pilot handoff.

## 2. Demo-Ready

These capabilities are suitable for customer walkthroughs and product validation:

| Area | Demo-ready capability | Evidence |
|---|---|---|
| Buyer main flow | Demand, approval, RFQ, quote comparison, award, order, receipt, invoice, payment registration | Stage eleven/twelve closeout docs, Java smoke path, backend tests |
| Supplier collaboration | RFQ invitation, quote submission, order confirmation, delivery, invoice, receivable note | Supplier stage twelve closeout docs |
| Platform operations | Tenant list, enterprise review, announcements, usage-oriented operations | Platform stage twelve closeout docs |
| Contract | Ledger, approval, fulfillment events, milestones, renewal/expiry reminder, payment linkage | Contract stage ten/thirteen docs and recent contract tests |
| Finance | Three-way match, payment request, payment batches, block resolution, archive exception flow | Finance stage four docs and Java smoke path |
| Observability baseline | Prometheus, Grafana, Alertmanager sample routing, backend health/metrics | `docs/production-readiness.md`, `infra/observability/` |
| Contract artifacts | Backend OpenAPI and generated client are synchronized | `npm run verify`, OpenAPI sync test |

## 3. Pilot-Ready With Controls

These capabilities can be used in a controlled pilot if the listed controls are accepted:

| Area | Pilot control |
|---|---|
| Authentication | Use Keycloak/OIDC as primary login; keep self-issued login as a controlled fallback only if explicitly allowed. |
| Secrets | Set `JWT_SECRET`, MinIO credentials, Grafana password, and `AWARD_NOTICE_SIGNATURE_SECRET`; start production-like services with `-Dprocurement.award-notice.allow-demo-secret=false`. |
| Permissions | Menu permission and role data-scope behavior are covered by tests; before pilot, confirm pilot roles and data-scope assignments against real org structure. |
| Data scope | Purchase-demand, RFQ, and contract lists have representative data-scope enforcement; payment-batch list coverage should be expanded before broad pilot access. |
| Deployment | Follow `docs/production-readiness.md` release, rollback, backup, and smoke-check sequence. |
| Load testing | Use `npm run loadtest` for read paths and `npm run loadtest:write` against an isolated test database before pilot signoff. |
| Backups | Rehearse PostgreSQL, MinIO, and Keycloak realm restore before loading pilot data. |

## 4. Production Blockers

Do not claim production readiness until these are closed:

1. Data-scope enforcement must be expanded and verified for payment-batch and other sensitive buyer list APIs.
2. Alertmanager receivers must be wired to real email, DingTalk, WeCom, or an internal incident platform with named owners.
3. Backup and restore rehearsal must be completed in a temporary environment.
4. Production Keycloak realm, MinIO bucket policy, PostgreSQL backup policy, and secret rotation policy must be documented.
5. Real payment, tax invoicing, ERP/OA/finance integration, and legally binding e-signature are not implemented.
6. Complex public tendering, auction, expert evaluation, bid bond, and formal bid-opening compliance remain future business tracks.

## 5. Acceptance Checklist

Before a pilot handoff:

1. Run `npm run verify` and record the result.
2. Run `docker compose -f infra/docker-compose.yml --profile observability config` and verify the observability stack configuration parses.
3. Run `npm run loadtest` against the pilot-like backend.
4. Run `npm run loadtest:write` against an isolated test database.
5. Confirm buyer roles, permissions, and data scopes with the pilot org chart.
6. Confirm production secrets are injected and demo-secret fallback is disabled.
7. Confirm backup and restore rehearsal results are documented.

## 6. Recommended Next Track

After the remaining Track A blockers are closed, the next best product track is Track B: finance and contract deepening.

Recommended first slices:

1. Contract milestone settlement rules.
2. Payment batch approval/release evidence.
3. Contract-to-payment reconciliation view.
4. Finance exception dashboard.
