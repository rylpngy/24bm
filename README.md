# 24Bid Procurement SaaS

24Bid is a Java-backed multi-enterprise procurement SaaS with three refactored React workspaces:

- Buyer tenant portal: `apps/tenant-portal` on `http://localhost:5173`
- Platform admin: `apps/platform-admin` on `http://localhost:5174`
- Supplier portal: `apps/supplier-portal` on `http://localhost:5175`

The old root Vite prototype has been retired. New backend business work belongs in `backend-java/`; new frontend work belongs in the matching `apps/*` workspace or shared `packages/*` library.

## Local Development

Prerequisites:

- Node.js
- Java 21
- Docker, for local PostgreSQL and Keycloak
- PostgreSQL and Keycloak are provided by `infra/docker-compose.yml` for the Java local profile

Install frontend dependencies:

```bash
pnpm install
```

Start local infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d postgres keycloak
```

Start the Java backend:

```bash
cd backend-java
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Start a frontend workspace against Java:

```bash
pnpm dev:portal
pnpm dev:admin
pnpm dev:supplier
```

The default API base URL for the refactored apps is `http://localhost:8080`. Override it per command when needed:

```bash
VITE_JAVA_API_BASE_URL=http://localhost:8080 pnpm dev:portal
```

If your global `pnpm` is not the workspace version, run commands through the pinned package manager:

```bash
npx -y pnpm@9.15.0 --filter @24bid/tenant-portal dev
```

## Local Demo Accounts

Keycloak runs at `http://localhost:8081/realms/24bid` with client `24bid-portal`.

| Portal | Username | Password |
| --- | --- | --- |
| Buyer tenant portal | `buyer.owner@example.com` | `demo123456` |
| Buyer requester | `zhang.req@example.com` | `demo123456` |
| Buyer finance | `li.fin@example.com` | `demo123456` |
| Supplier portal | `supplier.sales@example.com` | `demo123456` |
| Platform admin | `platform.admin@example.com` | `demo123456` |

## Verification

```bash
npx -y pnpm@9.15.0 verify
npx -y pnpm@9.15.0 acceptance:api
npx -y pnpm@9.15.0 e2e
```

For the full local Java workflow, see [docs/local-java-integration.md](docs/local-java-integration.md).
