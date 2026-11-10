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

## 招标代理业务 P1

采购包档案、公司年度编号、成员与文件权限、建档及重要变更审批已接入。开发与验收说明见 [docs/agency/README.md](docs/agency/README.md)。独立本地环境使用18080/15173端口，避免连接默认8080上的其他系统。

P2 procurement execution workspace: [交付说明](docs/agency/P2交付说明.md), including demand provenance, versioned templates, DOCX candidates, independent approvals, manual publication, participation, plans and preparation.

P6 非AI增强：在线Office编辑、PDF/OCR及版本预览、受控短信网关和运维验证，见[二期台账](docs/agency/二期非AI连续研发台账.md)与[服务接入说明](docs/agency/P6非AI服务接入与运维说明.md)。AI及全流程电子标按用户最新决定暂缓，实际外部服务及生产验收单列。

当前百炼接入与本机走查部署见[P7说明](docs/agency/P7百炼接入与走查部署说明.md)。用户提供的模型凭据仅保存在被Git忽略的私有配置，源码仓库不包含密钥。
