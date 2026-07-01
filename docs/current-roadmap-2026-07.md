# 24Bid Current Roadmap Baseline

> Updated: 2026-07-01
> Purpose: Codex handoff baseline after the Claude development streak. This document reconciles historical stage notes, recent commits, and the current code shape so future work starts from the same truth.

## 1. Executive Conclusion

24Bid has moved past the early "frontend prototype" and "thin Java backend" stages. The current system is a three-portal procurement SaaS prototype with a Spring Boot backend, generated API client, real Java data paths, workflow/auth/storage infrastructure, and substantial procurement business depth.

The next development phase should not begin by opening another large business domain. The recommended path is:

1. Freeze the current capability baseline.
2. Reconcile stale roadmap and standard-gap documents with the code.
3. Close production-governance gaps around permissions, deployment readiness, security configuration, and regression evidence.
4. Then choose one business vertical for the next deepening round.

## 2. Source Hierarchy

Use this priority when older documents conflict:

1. Current code and database migrations.
2. Recent commits.
3. Refreshed roadmap notes from 2026-06-29.
4. Stage closeout packages and presenter runbooks.
5. Older historical planning sections from 2026-06-24 and earlier.

Important historical documents remain useful, but many sections are now evidence trails rather than active plans. For example, `docs/后续研发路线.md` and `docs/标准对标差距分析.md` still contain older stage plans after their refreshed sections; those older sections should not be treated as the current backlog.

## 3. Current Capability Baseline

### 3.1 Architecture And Tooling

Completed or substantially in place:

- Spring Boot modular backend with module/package boundaries and architecture tests.
- PostgreSQL + Flyway.
- Backend-generated OpenAPI and generated frontend API client/hooks.
- Three frontend apps: buyer tenant portal, supplier portal, and platform admin.
- Shared UI package and shared navigation definitions.
- TanStack Query, React Hook Form, Zod, Zustand, and modern frontend testing/build stack.
- Flowable-style process/workflow capability.
- Keycloak/OIDC primary login path with development fallback auth.
- MinIO-backed attachment direction.
- Playwright E2E and production-readiness documentation.
- Prometheus/Grafana observability assets and load-test baseline.

### 3.2 Business Flow

The procurement main flow is broad and deep:

- Demand intake, approval, and conversion to RFQ.
- RFQ creation, invitations, clarifications, bid opening, multi-round quotation, BAFO, method-specific award rules, award notices, and award publication.
- Supplier quote response, order confirmation, delivery, invoicing, and receivable notes.
- Purchase orders, receipt acceptance, inspection quality results, invoice registration, payment registration, payment batches, and exception handling.
- Contract ledger, approval, fulfillment events, milestones, amendments, renewal/expiry reminders, and milestone/payment linkage.
- Budget pool, occupation/release, actual-paid linkage, and warning behavior.
- Supplier relationship management, admission, qualification, performance review, and auto-scoring.
- Platform tenant governance, enterprise reviews, announcements, and usage-oriented operations.

### 3.3 Demo Readiness

The system has enough real Java-backed actions for a customer demo:

- Buyer main flow: demand to payment registration.
- Supplier collaboration: quote to receivable note.
- Platform operations: tenant governance, enterprise review, and announcements.

This is a demo-grade and pilot-preparation baseline, not a claim of production completeness. It does not yet imply real payment, tax invoicing, external ERP/OA/finance integrations, production e-signature compliance, or complete tender/auction coverage.

## 4. Drift Found During Handoff

### 4.1 Documentation Drift

Several documents still describe gaps that the code has since partially or fully addressed.

Examples:

- Menu-level permission is now represented through navigation `requiredPermission` and frontend permission filtering.
- Data scopes support `all`, `department_and_below`, `department`, and `self` in backend domain code.
- The buyer team permission workbench exposes role permissions and data-scope editing.
- Permission/data-scope regression coverage now includes frontend menu matching, role data-scope parsing, active buyer-role SQL filtering, and purchase-demand list blocking when the effective data scope has no visible departments.
- Some 2026-06-24 roadmap sections still describe monolith/frontend-app issues that have already been resolved.

Action: keep the historical documents, but mark the refreshed/current sections clearly and avoid using old gap lists as active backlogs.

### 4.2 Implementation Drift

Some implementation comments and documents disagree with current behavior.

Known example:

- `apps/tenant-portal/src/features/team/role-permission-workbench.tsx` contains a comment saying the backend data scope only supports `all / department`, while backend `DataScope` now supports four scopes.

Action: remove misleading comments and add a small regression check where practical.

### 4.3 Production-Governance Drift

Some features are deliberately demo-grade and should be hardened before pilot use.

Known example:

- `AwardNoticeSignature` uses an embedded demo HMAC secret. The code comment already states production should inject the secret via KMS/config.

Action: externalize production secrets and fail fast outside local/demo profiles when required secrets are missing.

## 5. Recommended Main Track

### Track A: Production Governance And Permission Closeout

This is the recommended next track.

Goal: make the existing product surface more reliable, auditable, deployable, and explainable before adding a major new business domain.

Why this track comes first:

- The business surface is already broad.
- Recent commits added many valuable deepening features quickly.
- Stale documents now create execution risk.
- Production-readiness docs already list concrete remaining work.
- Permission and data-scope behavior is central to SaaS trust.

Expected outcome:

- A clean current roadmap.
- Updated standard-gap assessment.
- Permission/data-scope behavior aligned across backend, frontend, and docs. Current evidence covers menu matching, role data-scope parsing, active buyer-role filtering, and purchase-demand list enforcement; remaining work is expanding the same pattern to RFQ, contract, and payment-batch lists.
- Production checklist expanded from "baseline" to "pilot handoff", including Alertmanager routing, deployment order, rollback, backup rehearsal, and write-path load testing.
- Security-sensitive demo shortcuts identified and removed or explicitly profile-gated. Award-notice signing now supports injected secrets and a production flag to disable demo-secret fallback.
- Regression evidence captured in tests and smoke scripts. `npm run verify` is the local gate.

## 6. Next Two-Week Execution Plan

### Week 1: Baseline And Governance

1. Roadmap reconciliation
   - Update `docs/后续研发路线.md` so its top section points to this baseline.
   - Update `docs/标准对标差距分析.md` to split resolved, partially resolved, and still-open items.
   - Add a short "do not use old sections as active backlog" note where needed.

2. Permission and data-scope consistency
   - Completed: fixed stale role-permission workbench comments.
   - Completed: verified menu-level permission matching through `packages/shared/src/navigation-permissions.test.ts`.
   - Completed: verified backend data-scope parsing and active buyer-role SQL filtering through `DataScopeServiceTests` and `DataScopeMapperSqlTests`.
   - Completed: verified representative purchase-demand list blocking for an empty effective department scope.
   - Remaining: expand representative data-scope enforcement to RFQ, contract, and payment-batch list APIs.

3. Security configuration hardening
   - Completed: externalized award notice signing secret through JVM property / `AWARD_NOTICE_SIGNATURE_SECRET`.
   - Completed: kept demo fallback for local/CI and added `procurement.award-notice.allow-demo-secret=false` for production hardening.
   - Completed: added tests proving configured secrets change signatures and disabled demo fallback fails fast.

4. Verification baseline
   - Keep `npm run verify` green.
   - Record any required environment assumptions in `docs/production-readiness.md`.

### Week 2: Pilot Readiness

1. Deployment checklist
   - Completed: extended `docs/production-readiness.md` with image build, environment variables, database migration, rollback, backup, and restore rehearsal steps.

2. Alert routing
   - Completed: added Alertmanager compose service and sample webhook routing.
   - Remaining: bind production webhook/email receiver and owner escalation outside the repository.

3. Write-path load testing
   - Completed: added `scripts/loadtest-write-paths.mjs`, covering demand creation, RFQ creation, quote submission, order fulfillment, receipt, invoice, and payment-request creation in a controlled local profile.

4. Demo-to-pilot acceptance package
   - Produce a concise acceptance package that separates demo-ready, pilot-ready, and production-blocked capabilities.

## 7. Business Tracks To Defer Until Track A Is Done

### Track B: Finance And Contract Deepening

Best next business track after Track A. It builds on existing payment batches, archive exceptions, budget actual-paid linkage, contract milestones, and renewal reminders.

Candidate scope:

- Contract milestone settlement rules.
- Payment batch approval and release evidence.
- Finance exception dashboard.
- Contract-to-payment reconciliation view.

### Track C: Tender/Auction Expansion

High value, but it opens a large new domain. Start only after current governance and pilot-readiness work is stable.

Candidate scope:

- Sealed tender.
- Auction/bidding rounds.
- Evaluation methods and expert scoring.
- Bid bond and formal opening records.

### Track D: Platform Ecosystem

Useful if the immediate buyer is SaaS-operations focused.

Candidate scope:

- Tenant lifecycle.
- Feature toggles by package.
- Usage metering.
- Supplier marketplace and platform-side BI.

## 8. Operating Rules From Here

1. Do not open more than one major business vertical at a time.
2. Treat generated OpenAPI and generated client files as contract artifacts; keep sync tests.
3. Every backend capability that changes API behavior should have Java tests and OpenAPI/client sync.
4. Every customer-demo critical flow should have either E2E coverage or a documented smoke checklist.
5. Every production-sensitive shortcut must be local/demo-profile only or explicitly documented as production-blocking.
6. Update this baseline whenever a new track closes.

## 9. Immediate Next Actions

Recommended next implementation order:

1. Commit or otherwise preserve the current verified contract-expiry and notification-status work.
2. Update stale roadmap and standard-gap docs to reference this baseline.
3. Fix the role-permission workbench data-scope comment mismatch.
4. Externalize the award notice signing secret.
5. Extend production-readiness with deployment, alert routing, and write-path load testing.

The highest-confidence next engineering task is item 2 plus item 3 because they are low risk and remove handoff ambiguity. The highest-value hardening task is item 4 because it removes a known demo-grade security shortcut.
