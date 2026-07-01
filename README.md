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
- PostgreSQL for the Java local profile

Install frontend dependencies:

```bash
pnpm install
```

Start the Java backend:

```bash
cd backend-java
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
docker compose up -d
mvn clean spring-boot:run -Dspring-boot.run.profiles=local
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

## Verification

```bash
pnpm verify
```

For the full local Java workflow, see [docs/local-java-integration.md](docs/local-java-integration.md).
