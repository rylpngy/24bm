# 24Bid 后端骨架说明

## 后端方向调整

正式后端以 backend-java 为准，采用 Java 21 + Spring Boot 3 + PostgreSQL + Flyway 的企业级后端技术栈。

当前 `server/` 目录下的 TypeScript 服务层和 Hono HTTP API 仅作为 Node 后端原型保留，用于参考第一阶段询价比价闭环、接口字段和前端联调方式。该目录现在是只读参考，不要继续扩展 Node 后端原型；后续新业务能力必须进入 `backend-java/`。

## Node 后端原型

本阶段新增了 `server/procurementBackend.ts`，它是一个纯 TypeScript 的后端服务层骨架，暂时使用 `data/procurementModel.ts` 的内存数据作为仓储。

它已经表达第一阶段后端必须具备的核心边界：

- 采购方上下文：`auth.asBuyer(tenantId, userId)`
- 供应商上下文：`auth.asSupplier(supplierId, userId)`
- 平台上下文：`auth.asPlatform(userId)`
- 采购需求：创建、查询、提交审批
- RFQ：从已通过需求创建询价、邀请已准入供应商
- 报价：只有被邀请供应商可以报价
- 定标：只能选择有效报价
- 订单：根据定标结果生成采购订单

对应测试在 `server/procurementBackend.test.ts`。

## HTTP API 层

`server/httpApp.ts` 使用 Hono 暴露 `/api/v1` 路由，并把请求映射到服务层。

启动 legacy 本地 API：

```bash
npm run legacy:api:dev
```

命令行演示 legacy HTTP 闭环：

```bash
npm run legacy:api:demo
```

当前请求头约定：

- 采购方接口：`X-Tenant-Id` + `X-User-Id`
- 供应商接口：`X-Supplier-Id` + `X-User-Id`

已实现路由：

- `GET /api/v1/health`
- `GET /api/v1/platform/workspace`
- `GET /api/v1/buyer/workspace`
- `GET /api/v1/supplier/workspace`
- `GET /api/v1/buyer/demands`
- `POST /api/v1/buyer/demands`
- `POST /api/v1/buyer/demands/:demandId/submit`
- `GET /api/v1/buyer/rfqs`
- `POST /api/v1/buyer/rfqs`
- `POST /api/v1/supplier/rfqs/:rfqId/quotes`
- `POST /api/v1/buyer/rfqs/:rfqId/award`
- `POST /api/v1/buyer/orders`

## 前端 API Adapter

前端新增 `services/procurementApiClient.ts`，页面不再直接依赖 `data/procurementModel.ts`。

当前 adapter：

- `mockApiClient`：仅在显式 `VITE_DATA_SOURCE=mock` 时供页面使用，从本地 mock 模型返回平台、采购方、供应商工作台壳数据。
- `createHttpApiClient()`：调用 `/api/v1` HTTP API，已支持采购需求、RFQ、报价、定标、订单生成。
- `procurementApiClient`：legacy Node HTTP/demo client。主页面不再导入它；Java 后端联调使用 `VITE_JAVA_API_BASE_URL`，显式 mock 视觉模式使用 `VITE_DATA_SOURCE=mock`。

legacy 本地联调方式，仅用于回看旧原型行为：

```bash
npm run legacy:api:dev
VITE_API_BASE_URL=http://localhost:8787 npm run dev
```

后续接真实后端时，按 Java 路线处理：

1. 保留 `ProcurementApiClient` 接口。
2. 继续扩展 `createJavaProcurementApiClient()` 和 `backend-java/`。
3. 页面组件继续只消费 adapter 返回的数据结构，不直接读 mock model 或后端服务层。
4. 不要把新的业务流程、接口或数据库访问加回 `server/`。

## 服务层边界

服务层不直接依赖 React，也不直接读页面状态。后续接真实数据库时，应保留这些服务方法的语义，把内存数组替换为 Repository/DAO。

建议分层：

- `server/auth`：认证、租户上下文、供应商上下文。
- `server/repositories`：数据库访问。
- `server/services`：采购需求、RFQ、报价、定标、订单等业务规则。
- `server/http`：Express/Fastify/Hono 路由适配。
- `server/migrations`：数据库迁移。

## 数据库迁移

初始 PostgreSQL 迁移文件在：

- `server/migrations/001_initial_schema.sql`

该迁移覆盖：

- 租户、企业、供应商公共身份
- 用户、角色
- 采购方私域供应商关系
- 物料、采购需求、审批任务
- RFQ、邀请、报价、定标
- 订单、发货、收货、发票
- 附件、通知、审计日志

## Java 后端落地建议

1. 以 `backend-java/` 作为正式后端工程目录。
2. 将 `server/migrations/001_initial_schema.sql` 迁移为 Flyway 脚本 `backend-java/src/main/resources/db/migration/V1__initial_schema.sql`。
3. 按 `docs/openapi-draft.json` 和前端 `services/procurementApiClient.ts` 实现第一批 `/api/v1` REST API。
4. 用 Spring Security + JWT 建立平台方、采购方、供应商方三类身份上下文。
5. 按 `docs/java-backend-architecture.md` 的模块边界逐步实现 MVP 主流程。
