# 24Bid Procurement SaaS

24Bid is being refactored from a frontend prototype into a Java-backed multi-enterprise procurement SaaS. The existing React UI remains the visual shell; new backend business work belongs in `backend-java/`.

## Local Development

Prerequisites:

- Node.js
- Java 21
- PostgreSQL for the Java local profile

Install frontend dependencies:

```bash
npm install
```

Start the Java backend:

```bash
cd backend-java
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
docker compose up -d
mvn clean spring-boot:run -Dspring-boot.run.profiles=local
```

Start the frontend against Java:

```bash
npm run dev:java
```

Use mock mode only for local visual checks without Java:

```bash
npm run dev:mock
```

Legacy Node demo commands are intentionally kept under `legacy:*` names and should not receive new backend business features.

## Verification

```bash
npm run verify
```

For the full local Java workflow, see [docs/local-java-integration.md](docs/local-java-integration.md).
