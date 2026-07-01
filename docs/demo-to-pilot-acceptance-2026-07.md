# 24Bid Demo-To-Pilot Acceptance Package

> Updated: 2026-07-01
> Scope: separates customer-demo readiness, pilot readiness, and production blockers after the handoff governance pass.

## 1. Conclusion

24Bid is ready to continue as a Java-backed customer-demo and pilot-preparation baseline. It should not be represented as a fully production-ready procurement SaaS until the production blockers in section 4 are closed.

The next engineering direction is Track A closeout beyond data scope: keep `npm run verify` green, bind real operational receivers and backup rehearsals, and preserve clear evidence in `docs/pilot-operations-handoff-2026-07.md` for pilot handoff.

## 2. Demo-Ready

These capabilities are suitable for customer walkthroughs and product validation:

| Area | Demo-ready capability | Evidence |
|---|---|---|
| Buyer main flow | Demand, approval, RFQ, quote comparison, award, order, receipt, invoice, payment registration | Stage eleven/twelve closeout docs, Java smoke path, backend tests |
| Supplier collaboration | RFQ invitation, quote submission, order confirmation, delivery, invoice, receivable note | Supplier stage twelve closeout docs |
| Platform operations | Tenant list, enterprise review, announcements, usage-oriented operations | Platform stage twelve closeout docs |
| Contract | Ledger, approval, fulfillment events, milestones, renewal/expiry reminder, payment linkage | Contract stage ten/thirteen docs and recent contract tests |
| Finance | Three-way match, payment request, payment batches, block resolution, archive exception flow | Finance stage four docs and Java smoke path |
| Observability baseline | Prometheus, Grafana, Alertmanager sample routing, backend health/metrics | `docs/production-readiness.md`, `infra/observability/`, `docs/pilot-operations-handoff-2026-07.md` |
| Contract artifacts | Backend OpenAPI and generated client are synchronized | `npm run verify`, OpenAPI sync test |

## 3. Pilot-Ready With Controls

These capabilities can be used in a controlled pilot if the listed controls are accepted:

| Area | Pilot control |
|---|---|
| Authentication | Use Keycloak/OIDC as primary login; keep self-issued login as a controlled fallback only if explicitly allowed. |
| Secrets | Set `JWT_SECRET`, MinIO credentials, Grafana password, and `AWARD_NOTICE_SIGNATURE_SECRET`; start production-like services with `-Dprocurement.award-notice.allow-demo-secret=false`. |
| Permissions | Menu permission and role data-scope behavior are covered by tests; before pilot, confirm pilot roles and data-scope assignments against real org structure. |
| Data scope | Purchase-demand, RFQ, contract, and payment-batch lists have representative data-scope enforcement; confirm pilot role assignments against the real org chart before broad pilot access. |
| Deployment | Follow `docs/production-readiness.md` release, rollback, backup, and smoke-check sequence. |
| Load testing | Use `npm run loadtest` for read paths and `npm run loadtest:write` against an isolated test database before pilot signoff. |
| Backups | Rehearse PostgreSQL, MinIO, and Keycloak realm restore before loading pilot data; record evidence in the pilot operations handoff ledger. |

## 4. Production Blockers

Do not claim production readiness until these are closed:

1. Alertmanager receivers must be wired to real email, DingTalk, WeCom, or an internal incident platform with named owners; evidence is tracked in `docs/pilot-operations-handoff-2026-07.md`.
2. Backup and restore rehearsal must be completed in a temporary environment and recorded in the pilot operations handoff ledger.
3. Production Keycloak realm, MinIO bucket policy, PostgreSQL backup policy, and secret rotation policy must be documented in the controlled operations workspace and linked from the handoff ledger.
4. Real payment, tax invoicing, ERP/OA/finance integration, and legally binding e-signature are not implemented.
5. Complex public tendering, auction, expert evaluation, bid bond, and formal bid-opening compliance remain future business tracks.

## 5. Acceptance Checklist

Before a pilot handoff:

1. Run `npm run verify` and record the result.
2. Run `docker compose -f infra/docker-compose.yml --profile observability config` and verify the observability stack configuration parses.
3. Run `npm run loadtest` against the pilot-like backend.
4. Run `npm run loadtest:write` against an isolated test database.
5. Confirm buyer roles, permissions, and data scopes with the pilot org chart.
6. Confirm production secrets are injected and demo-secret fallback is disabled.
7. Confirm Alertmanager receiver tests, backup/restore rehearsal results, and production policy evidence are linked from `docs/pilot-operations-handoff-2026-07.md`.

## 6. Recommended Next Track

Track B has started with contract milestone settlement hardening. Continue finance and contract deepening in small audited slices.

Recommended first slices:

1. Payment batch approval/release evidence.
2. Contract-to-payment reconciliation view.
3. Finance exception dashboard.
