# Local Java Integration

This guide runs the Spring Boot backend and the Vite frontend together for the Java-backed SaaS workspaces.

## What Is Wired

- Java backend is the official backend direction under `backend-java/`.
- Frontend Java adapter is `createJavaProcurementApiClient` in `services/procurementApiClient.ts`.
- The frontend calls `POST /api/v1/auth/login`, caches platform, buyer, and supplier tokens, and sends `Authorization: Bearer <accessToken>` to Java endpoints.
- The platform workspace loads Java-backed aggregate data from `GET /api/v1/platform/workspace`.
- The buyer workspace loads Java-backed aggregate data from `GET /api/v1/buyer/workspace`.
- The supplier workspace loads Java-backed aggregate data from `GET /api/v1/supplier/workspace`.
- The page still uses mock workspace shells for display-only tenant and layout metadata while Java data overlays the real platform, buyer, and supplier records. The Node backend remains a legacy prototype only and should not receive new backend business features.
- Frontend Java-only approval copy lives in `data/approvalUi.ts`; it only formats reader-facing labels and status messages. Business status changes must remain owned by Java APIs and refreshed Java data.

## Workspace Boundary Before Java Refactor

Keep these artifacts as the active Java refactor path:

- `backend-java/`: official Spring Boot backend.
- `services/procurementApiClient.ts`: frontend adapter for Java API calls.
- `data/approvalUi.ts`: frontend-only display helper for Java approval tasks.
- `docs/java-backend-architecture.md` and this guide: source of current backend boundary and local verification commands.

Treat these artifacts as temporary or legacy:

- `server/`: Node prototype, useful for field and flow reference only.
- `scripts/*legacy*` and legacy API scripts: local demo/reference utilities only.
- `data/procurementModel.ts`: mock frontend data model, not the source of truth for Java domain modeling.

Do not delete legacy files while frontend tests still cover them. Retire them in a later cleanup step after the Java-backed frontend path covers the same visible flows and the test suite has been moved off the Node prototype.

## Backend: Verify And Start

Use Java 21 from Homebrew:

```bash
cd backend-java
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
mvn test
docker compose up -d
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

The default backend URL is:

```text
http://localhost:8080
```

The `local` Spring profile uses PostgreSQL at `jdbc:postgresql://localhost:5432/procurement_saas` and loads demo seed rows from `db/dev`. The seeded buyer tenant is `tenant-acme`, matching the default frontend demo login.

## Frontend: Start With Java Backend Enabled

In another terminal:

```bash
npm run dev:java
```

Optional demo login overrides:

```bash
VITE_JAVA_BUYER_ACCOUNT=buyer \
VITE_JAVA_BUYER_PASSWORD=demo123456 \
VITE_JAVA_BUYER_TENANT_ID=tenant-acme \
VITE_JAVA_PLATFORM_ACCOUNT=platform \
VITE_JAVA_PLATFORM_PASSWORD=demo123456 \
VITE_JAVA_API_BASE_URL=http://localhost:8080 \
npm run dev
```

The `dev:java` script sets `VITE_JAVA_API_BASE_URL=http://localhost:8080` for the standard local backend. The raw `npm run dev` command is still available for custom environment overrides; if `VITE_JAVA_API_BASE_URL` is not set, the page surfaces a configuration error instead of silently using mock data. Use explicit mock mode only when you intentionally want the local visual shell without Java:

```bash
npm run dev:mock
```

## CORS For Local Browser Calls

Spring Security allows local Vite origins for Java API calls:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

The backend accepts `GET`, `POST`, and `OPTIONS`, including the `Authorization` and `content-type` headers. This is required because browser calls with `Authorization: Bearer <accessToken>` trigger a CORS preflight request before hitting buyer APIs.

## Smoke Check

1. Open the Vite URL.
2. Go to the platform workspace and confirm tenant count, public supplier count, pending review count, and tenant rows are loaded through the Java platform workspace overlay.
3. Go to the buyer workspace.
4. Confirm the private supplier relation cards, material-backed sections, buyer users, purchase demand cards, RFQ cards, order sections, and invoice/payment sections are loaded through the Java buyer workspace overlay.
5. Go to the supplier workspace and confirm supplier profile, RFQ opportunities, quotes, sales orders, and receivables are loaded through the Java supplier workspace overlay.
6. In the buyer workspace, confirm Java approval tasks appear in `审批待办` when pending demand, supplier admission, or award approval tasks exist.
7. Click approval actions in `审批待办` and confirm the page refreshes Java buyer data after the review result.
8. Click `跑通主流程` in the buyer workspace to execute the Java-backed RFQ, quote, award approval, order, supplier confirmation, delivery, receipt, invoice, and payment-status path.
9. If the Java service is unavailable while `VITE_JAVA_API_BASE_URL` is set, the page will surface a load error instead of silently using stale Java data.

Run the API smoke check after Spring Boot is up:

```bash
npm run java:smoke
```

It logs in as the seeded platform, buyer, and supplier accounts, verifies `GET /api/v1/platform/workspace`, `GET /api/v1/buyer/workspace`, `GET /api/v1/supplier/workspace`, and the key list endpoints return expected Java data, then checks supplier admission submission, approval, and refreshed buyer workspace relation status when a pending admission relation is available. It also creates one RFQ, submits one supplier quote, submits and approves one award decision, creates one purchase order, confirms the order as supplier, submits one delivery, registers one receipt, creates one invoice, and registers payment status.

On a fresh local seed, the smoke script uses the pending supplier relation to verify `供应商准入提交、审批通过、买方工作台关系状态刷新`. If the local database has already admitted that relation from a previous run, the script skips only that supplier-admission mutation and continues with the RFQ-to-payment smoke path.

## Manual API Check

Login:

```bash
curl -s http://localhost:8080/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"account":"buyer","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}'
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
npm run verify
```

`npm run verify` runs:

- `npm run openapi:check`
- `npm test`
- `npm run build`
- `mvn test` in `backend-java/`

Use the lower-level commands when you need a narrower check:

```bash
npm run openapi:check
npm test
npm run build
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
- The first frontend Java overlay covers platform overview/tenants/reviews, buyer master data, buyer RFQs, purchase orders, invoice/payment status, and the supplier workspace list views.
