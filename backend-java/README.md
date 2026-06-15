# 24Bid Java Backend

This module is the official backend direction for the multi-tenant procurement SaaS.

## Stack

- Java 21
- Spring Boot 3
- Spring Security
- PostgreSQL
- MyBatis
- Flyway
- JUnit 5
- Testcontainers

## Runtime Boundary

The frontend should call this service through `VITE_JAVA_API_BASE_URL`.

The existing TypeScript backend under `server/` is retained only as a prototype and business-flow reference. New backend work should be implemented here.

The frontend has a Java-oriented API adapter in `services/procurementApiClient.ts` via `createJavaProcurementApiClient`. It logs in through `POST /api/v1/auth/login` and calls Java endpoints with `Authorization: Bearer <accessToken>`. The older `createHttpApiClient` still targets the Node prototype headers and should be treated as temporary.

## Authentication Skeleton

The first Java backend iteration exposes:

- `GET /api/v1/health`
- `POST /api/v1/auth/login`

Demo login accepts password `demo123456` and one of these explicit scopes:

- `BUYER` requires `tenantId` and must not include `supplierId`.
- `SUPPLIER` requires `supplierId` and must not include `tenantId`.
- `PLATFORM` must not include either `tenantId` or `supplierId`.

```json
{
  "account": "buyer",
  "password": "demo123456",
  "scope": "BUYER",
  "tenantId": "tenant-acme"
}
```

```json
{
  "account": "supplier",
  "password": "demo123456",
  "scope": "SUPPLIER",
  "supplierId": "ent-supplier-sunrise"
}
```

```json
{
  "account": "platform",
  "password": "demo123456",
  "scope": "PLATFORM"
}
```

Use the returned token as:

```text
Authorization: Bearer <accessToken>
```

## Purchase Demand APIs

The first Java business module exposes buyer-side purchase demand APIs:

- `GET /api/v1/buyer/demands`
- `POST /api/v1/buyer/demands`
- `POST /api/v1/buyer/demands/{demandId}/submit`

Example creation payload:

```json
{
  "title": "办公电脑采购",
  "departmentId": "dept-it",
  "budget": 120000,
  "lineItems": [
    {
      "materialId": "mat-laptop-pro",
      "quantity": 20
    }
  ]
}
```

Demand creation stores `草稿` and records an `audit_logs` row with action `purchase_demand.created`. Submit changes the demand to `审批中` and creates an `approval_tasks` row with `biz_type = purchase_demand`.

## Buyer Audit Log APIs

The buyer-side audit endpoint is:

- `GET /api/v1/buyer/audit-logs`

It returns recent audit logs for the current buyer tenant from the JWT `tenantId`. The optional `limit` query parameter is clamped by the service to keep responses bounded.

## Buyer Attachment Metadata APIs

The buyer-side attachment metadata endpoints are:

- `GET /api/v1/buyer/attachments?ownerType=purchase_demand&ownerId=demand-demo`
- `POST /api/v1/buyer/attachments`

Example metadata registration payload:

```json
{
  "ownerType": "purchase_demand",
  "ownerId": "demand-demo",
  "fileName": "需求规格书.pdf",
  "storageKey": "tenant-acme/purchase_demand/demand-demo/spec.pdf"
}
```

The API records metadata only. The current buyer tenant and uploader are read from JWT claims, and registration writes an `audit_logs` row with action `attachment.created`.

## Buyer Notification APIs

The buyer-side in-app notification endpoints are:

- `GET /api/v1/buyer/notifications`
- `POST /api/v1/buyer/notifications/{notificationId}/read`

Notifications are scoped by the JWT `tenantId` and current `userId`. A buyer user can list and mark only their own notifications. Email and SMS delivery are intentionally deferred; the MVP keeps this module as in-app notification data first.

Purchase demand submission now creates in-app notifications for active buyer users in the current tenant with title `采购需求待审批`.
RFQ award approval submission also creates in-app notifications for active buyer users with title `定标结果待审批`.
Supplier order confirmation creates in-app notifications for active buyer users with title `采购订单已确认`.

## Buyer Master Data APIs

The first buyer-side master data endpoints are:

- `GET /api/v1/buyer/suppliers`
- `POST /api/v1/buyer/suppliers`
- `GET /api/v1/buyer/materials`
- `POST /api/v1/buyer/materials`
- `GET /api/v1/buyer/users`
- `POST /api/v1/buyer/users`

Example supplier relation payload:

```json
{
  "supplierId": "ent-supplier-sunrise",
  "status": "待准入",
  "level": "B",
  "categories": ["办公设备"]
}
```

Example material payload:

```json
{
  "code": "IT-LAPTOP",
  "name": "办公电脑",
  "category": "办公设备",
  "unit": "台",
  "referencePrice": 6000
}
```

Example buyer user payload:

```json
{
  "name": "需求申请人",
  "mobile": "13900000000",
  "email": "requester@example.com",
  "status": "active"
}
```

Buyer master data APIs use the buyer tenant from the JWT and reject supplier or platform tokens.

## Platform APIs

The first platform-side MVP endpoints are:

- `GET /api/v1/platform/overview`
- `GET /api/v1/platform/tenants`
- `POST /api/v1/platform/tenants/{tenantId}/features`
- `GET /api/v1/platform/enterprise-reviews`
- `POST /api/v1/platform/enterprise-reviews/{enterpriseId}`

Example feature toggle payload:

```json
{
  "enabledFeatures": ["rfq", "order", "finance"]
}
```

Example enterprise review payload:

```json
{
  "verified": true,
  "reviewStatus": "approved"
}
```

Platform APIs require a `PLATFORM` login token. Buyer and supplier tokens are rejected by path-level Spring Security rules.

## RFQ APIs

The first sourcing module exposes buyer-side RFQ APIs:

- `GET /api/v1/buyer/rfqs`
- `POST /api/v1/buyer/rfqs`

Example creation payload:

```json
{
  "title": "办公电脑 RFQ",
  "demandIds": ["dem-approved-001"],
  "invitedSupplierIds": ["ent-supplier-sunrise"],
  "deadlineAt": "2026-07-01T18:00:00+08:00"
}
```

RFQ creation requires every demand to be `已通过` within the current tenant and every invited supplier to be `已准入` in `buyer_supplier_relations`. Creation stores the RFQ as `报价中`, links `rfq_demands`, and creates `rfq_invites`.

## Supplier Quote APIs

The supplier-side sourcing endpoints are:

- `GET /api/v1/supplier/profile`
- `GET /api/v1/supplier/rfqs`
- `GET /api/v1/supplier/quotes`
- `POST /api/v1/supplier/rfqs/{rfqId}/quotes`

Example submission payload:

```json
{
  "amount": 98000,
  "taxRate": 13,
  "deliveryDays": 7
}
```

Quote submission uses the supplier identity from `Authorization: Bearer <accessToken>`. The supplier must be invited to the RFQ, the RFQ must be `报价中`, and each supplier can only keep one `已提交` quote per RFQ.

## Award Approval APIs

The buyer-side award endpoints are:

- `POST /api/v1/buyer/rfqs/{rfqId}/award`
- `POST /api/v1/buyer/rfqs/{rfqId}/award/approval`

Example award submission payload:

```json
{
  "quoteId": "quote-submitted-001",
  "reason": "价格最低，交期满足要求"
}
```

Example award approval payload:

```json
{
  "awardId": "award-pending-001",
  "approved": true
}
```

Award submission requires a `已提交` quote under the current tenant RFQ. The service updates the RFQ to `定标审批中`, creates an `award_decisions` row with `approved_status = 审批中`, and creates an `approval_tasks` row with `biz_type = rfq_award`.

Award approval uses the RFQ ID plus award decision ID. Approval updates the RFQ to `已定标`, stores `awarded_supplier_id`, and changes the award decision to `已通过`. Rejection moves the RFQ back to `报价中` and changes the award decision to `已驳回`.

## Approval Inbox APIs

The buyer-side approval inbox endpoint is:

- `GET /api/v1/buyer/approvals/pending`

Approval tasks include `bizType`, `bizId`, and optional `parentBizId`. For `rfq_award`, `bizId` is the award decision ID and `parentBizId` is the RFQ ID. The frontend uses this shape to route demand, supplier admission, and award approvals without deriving backend state in React.

## Purchase Order APIs

The buyer-side order endpoint is:

- `GET /api/v1/buyer/orders`
- `POST /api/v1/buyer/orders`

Example order payload:

```json
{
  "awardId": "award-approved-001",
  "expectedReceiptDate": "2026-07-10"
}
```

Order creation requires an approved award decision in the current tenant. It creates a `purchase_orders` row with status `待供应商确认`. If an order already exists for the same tenant, RFQ, and supplier, the existing order is returned.

## Supplier Order Fulfillment APIs

The supplier-side order fulfillment endpoints are:

- `GET /api/v1/supplier/orders`
- `POST /api/v1/supplier/orders/{orderId}/confirm`
- `POST /api/v1/supplier/orders/{orderId}/deliveries`

Order confirmation uses the supplier identity from `Authorization: Bearer <accessToken>`. The order must belong to the current supplier and be `待供应商确认`. Confirmation updates the purchase order status to `待发货`.

Example delivery payload:

```json
{
  "carrier": "顺丰速运",
  "trackingNo": "SF1234567890"
}
```

Delivery creation uses the supplier identity from `Authorization: Bearer <accessToken>`. The order must belong to the current supplier and be `待发货`. Creation stores a `deliveries` row with status `已发货` and updates the purchase order status to `已发货`.

## Buyer Receipt APIs

The buyer-side receipt endpoint is:

- `POST /api/v1/buyer/orders/{orderId}/receipts`

Example receipt payload:

```json
{
  "result": "验收通过"
}
```

Receipt creation uses the buyer tenant and receiver identity from `Authorization: Bearer <accessToken>`. The order must belong to the current tenant and be `已发货`. Creation stores a `receipts` row and updates the purchase order status to `已收货`.

## Finance APIs

The supplier-side invoice endpoint is:

- `GET /api/v1/supplier/invoices`
- `POST /api/v1/supplier/orders/{orderId}/invoices`

Example invoice payload:

```json
{
  "amount": 98000,
  "invoiceNo": "INV-2026-0001"
}
```

The buyer-side payment endpoint is:

- `GET /api/v1/buyer/invoices`
- `POST /api/v1/buyer/invoices/{invoiceId}/payments`

Example payment payload:

```json
{
  "paymentStatus": "已付款"
}
```

Invoice creation requires the order to belong to the current supplier and be `已收货`. New invoices are stored with `payment_status = 待付款`. Payment registration is tenant scoped and updates `invoices.payment_status`.

## Local Commands

This module is verified with Java 21 and Maven. On macOS with Homebrew OpenJDK 21, use:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH

mvn test
mvn verify -Pintegration
```

The project includes `.mvn/settings.xml` and `.mvn/maven.config` so Maven uses the project-level mirror configuration during local verification.

`mvn verify -Pintegration` runs PostgreSQL integration tests through Testcontainers. Keep Docker running when you want to execute the database smoke tests locally; regular unit tests stay on `mvn test`.

To run the Java backend for local frontend integration, start PostgreSQL and the `local` Spring profile:

```bash
docker compose up -d
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

The `local` profile loads Flyway migrations from `db/migration` plus demo seed data from `db/dev`, including `tenant-acme`, buyer users, suppliers, supplier relations, and materials used by the Vite Java adapter.
