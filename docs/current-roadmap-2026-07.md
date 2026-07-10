# 24Bid Current Roadmap Baseline

> Updated: 2026-07-01
> Purpose: Codex handoff baseline after the Claude development streak. This document reconciles historical stage notes, recent commits, and the current code shape so future work starts from the same truth.

## 1. Executive Conclusion

24Bid has moved past the early "frontend prototype" and "thin Java backend" stages. The current system is a three-portal procurement SaaS prototype with a Spring Boot backend, generated API client, real Java data paths, workflow/auth/storage infrastructure, and substantial procurement business depth.

The repository was cleaned on 2026-07-01 to keep Claude's refactored monorepo as the active codebase. The retired root Vite prototype, Node/Hono prototype backend, stale draft OpenAPI, obsolete stage artifacts, and historical prompt exports are now available only through Git history.

The next development phase should continue from the refactored path:

1. Keep the local deployment and Keycloak baseline reproducible.
2. Maintain phase 1 + phase 2 API/page acceptance as the regression gate.
3. Continue Track B finance/contract deepening.
4. Harden pilot operations evidence while business slices are added.

## 2. Source Hierarchy

Use this priority when older documents conflict:

1. Current code and database migrations.
2. Recent commits.
3. Current docs in `docs/current-roadmap-2026-07.md`, `docs/product-business-framework.md`, `docs/demo-to-pilot-acceptance-2026-07.md`, `docs/pilot-operations-handoff-2026-07.md`, and `docs/production-readiness.md`.
4. Stage closeout packages and presenter runbooks that still exist in the cleaned tree.
5. Git history for retired legacy files.

Retired legacy files should not be treated as active backlog. Recover them from Git only when an audit trail is needed.

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

Several older documents described gaps that the code has since partially or fully addressed.

Examples:

- Menu-level permission is now represented through navigation `requiredPermission` and frontend permission filtering.
- Data scopes support `all`, `department_and_below`, `department`, and `self` in backend domain code.
- The buyer team permission workbench exposes role permissions and data-scope editing.
- Permission/data-scope regression coverage now includes frontend menu matching, role data-scope parsing, active buyer-role SQL filtering, and purchase-demand list blocking when the effective data scope has no visible departments.
- Some 2026-06-24 roadmap sections described monolith/frontend-app issues that have already been resolved.

Action: keep this baseline as the active roadmap and avoid reviving retired gap lists without checking current code first.

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
- Permission/data-scope behavior aligned across backend, frontend, and docs. Current evidence covers menu matching, role data-scope parsing, active buyer-role filtering, purchase-demand list enforcement, RFQ list enforcement through linked demand departments, contract list enforcement through the order/RFQ/demand chain, and payment-batch enforcement through the payment-request/order/RFQ/demand chain.
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
   - Completed: expanded RFQ list data-scope enforcement through linked purchase-demand departments and owner self-scope.
   - Completed: expanded contract list data-scope enforcement through related order, RFQ, and purchase-demand departments.
   - Completed: expanded payment-batch list data-scope enforcement through payment requests, related orders, RFQs, and purchase-demand departments.

3. Security configuration hardening
   - Completed: externalized award notice signing secret through JVM property / `AWARD_NOTICE_SIGNATURE_SECRET`.
   - Completed: kept demo fallback for local/CI and added `procurement.award-notice.allow-demo-secret=false` for production hardening.
   - Completed: added tests proving configured secrets change signatures and disabled demo fallback fails fast.

4. Verification baseline
   - Completed: local Keycloak realm and demo users are reproducible through `infra/keycloak/realm/24bid-realm.json`.
   - Completed: phase 1 + phase 2 API acceptance is captured in `scripts/portal-api-acceptance.mjs`.
   - Keep `npx -y pnpm@9.15.0 verify`, `npx -y pnpm@9.15.0 acceptance:api`, and `npx -y pnpm@9.15.0 e2e` green where the required local services are running.
   - Record any required environment assumptions in `docs/production-readiness.md`.

### Week 2: Pilot Readiness

1. Deployment checklist
   - Completed: extended `docs/production-readiness.md` with image build, environment variables, database migration, rollback, backup, and restore rehearsal steps.
   - Completed: added `docs/pilot-operations-handoff-2026-07.md` as the non-secret ledger for Alertmanager receiver tests, backup restore rehearsal evidence, and production policy signoff links.

2. Alert routing
   - Completed: added Alertmanager compose service and sample webhook routing.
   - Completed: documented production receiver binding, owner escalation, and synthetic alert evidence requirements.
   - External environment action: bind real webhook/email/incident receivers outside the repository and record evidence in the handoff ledger.

3. Write-path load testing
   - Completed: added `scripts/loadtest-write-paths.mjs`, covering demand creation, RFQ creation, quote submission, order fulfillment, receipt, invoice, and payment-request creation in a controlled local profile.

4. Demo-to-pilot acceptance package
   - Completed: produced and updated a concise acceptance package that separates demo-ready, pilot-ready, and production-blocked capabilities.

## 7. Business Tracks After Track A

### Track B: Finance And Contract Deepening

Current active business track. It builds on existing payment batches, archive exceptions, budget actual-paid linkage, contract milestones, and renewal reminders.

Started:

- Contract milestone settlement rules: milestone payment now enforces prior milestones already paid before later milestones can be registered as paid.
- Payment batch approval and release evidence: payment execution registration now requires the batch to be approved for payment, accepts release evidence fields, and exposes that evidence on execution records.

Completed 2026-07-10 (finance/contract closeout slice):

- Release evidence is now writable end to end: the registration endpoint accepts an optional `RegisterPaymentRequest` body, the generated client carries it, and the payment batch page collects evidence number/remark before registering.
- Payment batch approval actions (submit for approval, approve, archive) are wired in the tenant portal against the existing status endpoint.
- Archive exception disposal is a full loop in the finance exception dashboard: review approve/reject, controlled action registration, and closure.
- `scripts/portal-api-acceptance.mjs` now runs Track B write-path acceptance: unapproved-batch registration rejection, batch status round-trip, milestone out-of-order pay rejection, and budget `disbursed` exposure. Demo seed `V243` adds the finance approval templates the clean migration+demo path was missing.
- `DepartmentBudgetMapperSqlTests` guards the paid-milestone → contract → order → RFQ → demand → department budget `disbursed` chain.

Track B closeout complete (2026-07-10):

- `e2e/tenant-finance-flow.spec.ts` adds behavioral coverage: the release-evidence form is submitted against an unapproved batch and the backend guard error surfaces in the UI (no state change), and batch submit-for-approval advances status while premature approval is rejected. Both are rerun-tolerant.
- Contract approval review (`PUT contracts/{id}/approval-review`) is wired on the contracts page: contracts in 审批中 expose approve/reject actions (approve → 已生效, reject → back to 草案).

Track B is now closed.

### Auction (竞价) deepening — first slice landed 2026-07-10

Assessment found 竞价/商城/单一来源 all rode the 询比 engine with no method-specific behavior beyond `RfqMethod` counts; 商城 needs a whole new module (catalog shelf → cart → direct order) while 竞价 can reuse the RFQ engine, so 竞价 went first to honor the 1.0 framework's "竞价规则/过程/结果" promise:

- `rfqs` gains `auction_start_price` / `auction_min_decrement` (V167); the auction window reuses the existing quote deadline guard.
- `RfqAuctionPolicy` enforces creation params (positive start price, auction-only fields) and bid rules (first bid ≤ start price, later bids must undercut the current lowest by the decrement) on both quote submit and update.
- The current-round lowest bid is exposed to invited suppliers on auction RFQs only (`auctionLowestAmount`) — price competition is the point; other methods stay sealed.
- Tenant portal exposes start-price/decrement inputs when creating a 竞价 RFQ and shows the auction rule line; supplier portal shows start price, current lowest, and the max allowed next bid.
- 2026-07-10 follow-up (auction deepening slice 2): soft-close anti-sniping — a valid bid inside the last 5 minutes automatically extends the deadline by 5 minutes (`RfqAuctionPolicy.extendedDeadline`, applied on quote submit and update) and notifies the buyer plus all invited suppliers (竞价截止已顺延). Both portals poll live auctions every 5s (no polling when none is quoting): the supplier opportunities card shows remaining time and a 当前领先/已被超越 badge against the visible lowest bid.
- Not yet: realtime push (WebSocket; polling covers demo scale), auction-specific multi-round rules.

### Mall (商城) module — first slice landed 2026-07-10

New `mall` bounded context (registered in the module architecture tests): tenant-curated agreement-price shelf (`mall_listings`, V169 — admitted supplier × material × price with 在架/下架) plus catalog direct purchase. A direct order creates a mall anchor RFQ (method 商城, immediately 已定标 — satisfies the orders schema's NOT NULL rfq FK and keeps the data-scope chain) through `RfqApplicationService.createMallAnchor`, then a purchase order with a single agreement-price line through `PurchaseOrderApplicationService.createMallOrder`; cross-module access stays at the application layer (no new infrastructure/api boundary debt beyond the controller's standard ApiResponse entries, refrozen and reviewed). Guards: positive price, admitted-supplier-only publishing, on-shelf + positive quantity ordering. Tenant portal gains the 企业商城 module (shop + shelf tabs, keyword search, direct-buy). Demo seed V244.

- 2026-07-10 follow-up (mall slice 2): supplier self-service shelf — suppliers see the material catalogs of tenants where they are admitted (`/api/v1/supplier/mall/materials`), publish agreement-price listings, reprice, and toggle shelf status, with ownership guards (cannot touch another supplier's listing) and the controller covered by the HTTP security contract tests (supplier-only). Cart checkout (`POST /buyer/mall/orders/batch`) validates every item and merges lines per supplier into one multi-line order each. Supplier portal gains the 商城货架 module; the tenant mall gains an add-to-cart flow with per-supplier split on checkout.
- 2026-07-10 follow-up (mall closeout): mall spend analytics — `GET /buyer/mall/analytics` aggregates mall-channel orders (through 商城 anchor RFQs) into order count, total spend, on-shelf count, and per-supplier concentration; surfaced as a stats row on the tenant mall page.

### 1.0 feature closeout status (2026-07-10)

All four procurement methods are fully implemented with method-specific depth. The only deliberately deferred engineering item is WebSocket realtime push for auctions (conditional 5s polling covers demo/pilot scale). Remaining pilot gate items are environment-side only: bind real alert receivers and rehearse backup restore, with evidence recorded in `docs/pilot-operations-handoff-2026-07.md`.
- 2026-07-10 follow-up: 单一来源 now requires a source justification (`single_source_reason`, V168) at creation — non-single-source methods reject the field; the reason is echoed on RFQ responses and shown in the tenant portal. This closes the last 单一来源 gap against the 1.0 framework.

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

1. Finish phase 1 + phase 2 page/API acceptance and keep the result in commit history.
2. Build the contract-to-payment reconciliation view so contract milestones, payment batches, execution evidence, and archive status can be reviewed together.
3. Add a finance exception dashboard for blocked payment execution, variance handling, archive exception requests, and overdue payment evidence.
4. Continue production-readiness external work: bind real alert receivers, rehearse restore evidence, and record links in the pilot operations handoff ledger.
5. Keep `npx -y pnpm@9.15.0 verify` green after each small slice and preserve the result in commit history.

The highest-confidence next engineering task after acceptance is item 2 because the required domain objects already exist and the latest Track B slices have tightened milestone order and payment execution evidence.
