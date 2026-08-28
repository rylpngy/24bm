# Local Java Integration

This guide runs the Spring Boot backend and the refactored Vite workspaces together for the Java-backed SaaS.

## What Is Wired

- Java backend is the official backend direction under `backend-java/`.
- Frontend API access goes through `@24bid/api-client` in `packages/api-client`.
- Shared navigation, permissions, formatting, and tokens live in `packages/shared`.
- Shared UI primitives live in `packages/ui`.
- The buyer portal lives in `apps/tenant-portal` and starts on port `5173`.
- The platform admin lives in `apps/platform-admin` and starts on port `5174`.
- The supplier portal lives in `apps/supplier-portal` and starts on port `5175`.

## Workspace Boundary Before Java Refactor

Keep these artifacts as the active Java refactor path:

- `backend-java/`: official Spring Boot backend.
- `apps/*`: refactored frontend workspaces.
- `packages/api-client`: generated API client and HTTP mutator.
- `packages/shared`: shared navigation, permissions, and domain-facing helpers.
- `packages/ui`: shared UI primitives.
- `docs/java-backend-architecture.md` and this guide: source of current backend boundary and local verification commands.

## Backend: Verify And Start

Use Java 21 from Homebrew:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
mvn test
docker compose up -d
pnpm java:dev
```

`pnpm java:dev` starts Spring Boot from `backend-java/` with the local Flyway locations pinned:

```bash
APP_SEED_LOCATIONS='classpath:db/dev'
```

Use this npm script for local demos and Java smoke checks. It keeps the regular migrations and the `db/dev` demo seed path together, which avoids the local Flyway validation mismatch that can happen when the database already has the V100 dev seed migration recorded but the backend is started with only `db/migration`.

If you need to run the Maven command directly, keep the same Flyway location override:

```bash
cd backend-java
mvn spring-boot:run -Dspring-boot.run.profiles=local  # local profile 默认种子链=db/dev
```

The default backend URL is:

```text
http://localhost:8080
```

The `local` Spring profile uses PostgreSQL at `jdbc:postgresql://localhost:5432/procurement_saas` and loads demo seed rows from `db/dev`. The seeded buyer tenant is `tenant-acme`, matching the default frontend demo login. Demo login accounts resolve from `users.email` and validate password `demo123456` against `users.password_hash`.

## Frontend: Start With Java Backend Enabled

In another terminal:

```bash
pnpm dev:portal
```

In separate terminals, start the other workspaces when needed:

```bash
pnpm dev:admin
pnpm dev:supplier
```

Optional backend URL override:

```bash
VITE_JAVA_API_BASE_URL=http://localhost:8080 pnpm dev:portal
```

## CORS For Local Browser Calls

Spring Security allows local Vite origins for Java API calls:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5174`
- `http://localhost:5175`
- `http://127.0.0.1:5175`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

The backend accepts `GET`, `POST`, `PUT`, and `OPTIONS`, including the `Authorization` and `content-type` headers. This is required because browser calls with `Authorization: Bearer <accessToken>` trigger a CORS preflight request before hitting buyer APIs and Java status actions use `PUT`.

## Smoke Check

1. Open the Vite URL.
2. Go to the platform workspace and confirm tenant count, active tenant count, public supplier count, pending review count, platform operation summary, and tenant rows are loaded through the Java platform workspace overlay.
3. Go to the buyer workspace.
4. Confirm the private supplier relation cards, material-backed sections, buyer users, buyer todo summary, buyer approval history and in-app notifications, purchase demand cards, RFQ cards, order sections, and invoice/payment sections are loaded through the Java buyer workspace overlay.
5. Go to the supplier workspace and confirm supplier profile, RFQ opportunities, quotes, sales orders, todo summary, receivables, and recent in-app notifications are loaded through the Java supplier workspace overlay.
6. In the buyer workspace, confirm Java approval tasks appear in `审批待办` when pending demand, supplier admission, or award approval tasks exist.
7. Click approval actions in `审批待办` and confirm the page refreshes Java buyer data after the review result.
8. Click `跑通主流程` in the buyer workspace to execute the Java-backed RFQ, quote, award approval, order, supplier confirmation, delivery, receipt, invoice, and payment-status path.
9. If the Java service is unavailable while `VITE_JAVA_API_BASE_URL` is set, the page will surface a load error instead of silently using stale Java data.

Run the API smoke check after Spring Boot is up:

```bash
pnpm java:smoke
pnpm java:workflow-smoke
```

It logs in as the seeded platform, buyer, and supplier accounts, verifies `GET /api/v1/platform/workspace`, `GET /api/v1/buyer/workspace`, `GET /api/v1/supplier/workspace`, and the key list endpoints return expected Java data. It publishes a minimal Flowable definition only for business types that have never been configured, submits the business APIs with their published dynamic-form values, and completes approval only through `GET /api/v1/buyer/workflow/tasks` plus `POST /api/v1/buyer/workflow/tasks/{taskId}/complete`; it does not mutate legacy `approval_tasks` or use `/api/v1/buyer/approvals/pending` as an approval runtime. The smoke covers supplier admission when a pending relation exists, then demand → RFQ → quote → award → order → supplier confirmation → delivery → receipt → invoice. It temporarily creates a three-way amount variance in the locally created invoice, verifies payment-request blocking and variance handling, restores the source amount in a `finally` block, and rebuilds the ledger. It rejects and resubmits both payment request and payment batch through Flowable before their final approval, verifies the batch cannot be approved before all requests pass and payment registration remains blocked before batch approval, then registers local payment evidence, archives the batch, creates/approves/archives a contract, and completes the payment-archive-exception controlled-action closure path.

The variance smoke segment uses `psql` and the local database URL from `JAVA_SMOKE_DATABASE_URL`, `DB_URL`, or `postgresql://procurement:procurement@localhost:5432/procurement_saas`. If `psql` is not installed on the host machine, the script falls back to Docker and parses the database name and user from that same URL, so it cannot silently write the default `procurement_saas` database while the backend uses another database. Set `JAVA_SMOKE_POSTGRES_CONTAINER` only when the local PostgreSQL container has a non-default name.

On a fresh local seed, the smoke script uses the pending supplier relation to verify `供应商准入提交、审批通过、买方工作台关系状态刷新`. If the local database has already admitted that relation from a previous run, the script skips only that supplier-admission mutation and continues with the RFQ-to-payment smoke path.

For an isolated workflow database deliberately started without `db/demo`, use `JAVA_SKIP_PLATFORM_SMOKE=1` only to omit the platform workspace login check. A normal demo database should keep the default three-scope smoke; `db/demo/V245__demo_platform_login_password.sql` repairs the pre-existing platform identity row so its documented local credential is available. This was verified on 2026-08-26 with a fresh `procurement_saas_demo_smoke` database: the unskipped smoke logged in as platform, buyer, and supplier, and loaded all three workspaces successfully.

`pnpm java:workflow-smoke` is a separate Flowable-routing acceptance check. It creates a unique tenant fixture in the configured local smoke database, then verifies a candidate-role-to-department-manager two-level route, a low-amount default department-manager route, and cross-department task visibility/handling denial. Use an isolated non-production database because each run retains its uniquely named audit fixture for inspection.

## Manual API Check

Login:

```bash
curl -s http://localhost:8080/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"account":"buyer.owner@example.com","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}'
```

Use the returned token:

```bash
TOKEN=<accessToken>
curl -s http://localhost:8080/api/v1/buyer/suppliers \
  -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/api/v1/buyer/materials \
  -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/api/v1/buyer/users \
  -H "Authorization: Bearer $TOKEN"
```

## Verification Commands

Run the regular local baseline before and after Java backend refactors:

```bash
pnpm verify
```

`npm run verify` runs:

- `pnpm openapi:check`
- `pnpm test`
- `pnpm build`
- `mvn clean test` in `backend-java/`

Use the lower-level commands when you need a narrower check:

```bash
pnpm openapi:check
pnpm test
pnpm build
```

Java backend only:

```bash
cd backend-java
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
mvn test
mvn verify -Pintegration
```

`mvn verify -Pintegration` is intentionally not part of `npm run verify`; it runs the Testcontainers PostgreSQL smoke test and requires Docker. Keep Docker daemon running if you want `DatabaseMigrationIT` to start PostgreSQL instead of being skipped by Testcontainers.

## Current Limits

- Docker daemon is required for database integration tests.
- Without a running PostgreSQL database and seeded rows, Spring Boot can start but Java list endpoints will return whatever the configured database contains.
- The Node backend remains a legacy prototype only; do not extend it for new backend business features.
- The first frontend Java overlay covers platform overview/tenants/reviews, buyer master data, buyer RFQs, purchase orders, invoice/payment status, and the supplier workspace list views plus recent supplier notifications.
