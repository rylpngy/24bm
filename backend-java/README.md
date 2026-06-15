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

Demo login reads the active user, password hash, and roles from the database by `account` (email, mobile, or user ID). The local seed stores a BCrypt hash for password `demo123456` in `users.password_hash` and accepts one of these explicit scopes:

- `BUYER` requires `tenantId` and must not include `supplierId`.
- `SUPPLIER` requires `supplierId` and must not include `tenantId`.
- `PLATFORM` must not include either `tenantId` or `supplierId`.

```json
{
  "account": "buyer.owner@example.com",
  "password": "demo123456",
  "scope": "BUYER",
  "tenantId": "tenant-acme"
}
```

```json
{
  "account": "supplier.sales@example.com",
  "password": "demo123456",
  "scope": "SUPPLIER",
  "supplierId": "ent-supplier-sunrise"
}
```

```json
{
  "account": "platform.admin@example.com",
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

Demand creation requires `departmentId` to belong to an active department in the current buyer tenant, stores `草稿`, and records an `audit_logs` row with action `purchase_demand.created`. Submit changes the demand to `审批中` and creates a pending approval task through `ApprovalTaskApplicationService` with `biz_type = purchase_demand` and fixed template `TPL_PURCHASE_DEMAND`.

The buyer demand list accepts optional `status`, `departmentId`, and `keyword` filters inside the current buyer tenant. `keyword` matches the demand title.

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
  "storageKey": "tenant-acme/purchase_demand/demand-demo/spec.pdf",
  "visibility": "tenant"
}
```

The API records metadata only. The current buyer tenant and uploader are read from JWT claims, and registration writes an `audit_logs` row with action `attachment.created`. `visibility` is optional and defaults to `tenant`; supported values are `tenant`, `buyer_internal`, and `supplier_shared`. New attachments are stored as `active`, and list queries only return active metadata.

## Notification APIs

The buyer-side in-app notification endpoints are:

- `GET /api/v1/buyer/notifications`
- `POST /api/v1/buyer/notifications/{notificationId}/read`

Notifications are scoped by the JWT `tenantId` and current `userId`. A buyer user can list and mark only their own notifications. Email and SMS delivery are intentionally deferred; the MVP keeps this module as in-app notification data first.

The supplier-side in-app notification endpoints are:

- `GET /api/v1/supplier/notifications`
- `POST /api/v1/supplier/notifications/{notificationId}/read`

Supplier notifications are scoped by the JWT `supplierId` and current `userId`; the stored `tenant_id` remains the buyer tenant that produced the business event.

Purchase demand submission now creates in-app notifications for active buyer users in the current tenant with title `采购需求待审批`.
RFQ award approval submission also creates in-app notifications for active buyer users with title `定标结果待审批`.
Supplier order confirmation creates in-app notifications for active buyer users with title `采购订单已确认`.
Supplier shipment creates in-app notifications for active buyer users with title `采购订单已发货`.
Buyer receipt creates in-app notifications for active buyer users with title `采购订单已收货`.
Supplier invoice creation creates in-app notifications for active buyer users with title `供应商已登记发票`.
Buyer payment registration creates in-app notifications for active supplier users with title `发票已付款` or `发票部分付款`.

## Buyer Master Data APIs

The first buyer-side master data endpoints are:

- `GET /api/v1/buyer/suppliers`
- `POST /api/v1/buyer/suppliers`
- `GET /api/v1/buyer/materials`
- `POST /api/v1/buyer/materials`
- `POST /api/v1/buyer/materials/{materialId}`
- `GET /api/v1/buyer/departments`
- `POST /api/v1/buyer/departments`
- `POST /api/v1/buyer/departments/{departmentId}/disable`
- `GET /api/v1/buyer/roles`
- `GET /api/v1/buyer/users`
- `POST /api/v1/buyer/users`
- `POST /api/v1/buyer/users/{userId}/role`
- `POST /api/v1/buyer/users/{userId}/password`
- `POST /api/v1/buyer/users/{userId}/status`

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
  "status": "active",
  "departmentId": "dept-it",
  "roleId": "role-buyer-requester",
  "initialPassword": "requester-password"
}
```

Buyer master data APIs use the buyer tenant from the JWT and reject supplier or platform tokens.

The buyer supplier list accepts optional query filters: `status`, `level`, `category`, and `keyword`. Filtering always stays inside the current buyer tenant; `category` matches the relation's authorized category JSON array, and `keyword` matches supplier name or supplier ID.

Material maintenance updates `code`, `name`, `category`, `unit`, and `referencePrice` inside the current buyer tenant and records `material.updated`.

The material list accepts optional `category` and `keyword` filters inside the current buyer tenant. `keyword` matches material code or name.

Department listing returns only active departments from the current buyer tenant and is used by purchase demand creation to choose a valid `departmentId`. Department creation uses the buyer tenant from the JWT, stores new rows as `active`, allows a blank `parentId` for top-level departments, validates non-blank parents inside the current active tenant organization, and records `department.created` audit logs. Department disable is a soft status change to `inactive`, rejects departments referenced by purchase demands, and records `department.disabled`.

Buyer user creation is limited by the current tenant's `user_limit`; when the current buyer-user count reaches the plan limit, the API rejects the new user before insert. New buyer users must also reference an active `departmentId` and a buyer `roleId` in the current tenant, then the backend hashes `initialPassword`, writes `users.password_hash`, and writes the `user_roles` relation in the same transaction. Buyer user role changes validate both the target user and target `roleId` inside the current buyer tenant, replace the buyer role relation, and record `buyer_user.role_changed`. Password reset validates the target user inside the current tenant, hashes `newPassword`, updates `users.password_hash`, and records `buyer_user.password_reset`. Buyer user status changes only accept `active` or `inactive`, update the current tenant user row, and record `buyer_user.status_changed`.

The buyer user list accepts optional `status`, `departmentId`, and `keyword` filters inside the current buyer tenant. `keyword` matches user name, mobile, or email.

Creating buyer users, materials, and private supplier relations records audit log actions `buyer_user.created`, `material.created`, and `buyer_supplier_relation.created`.

## Platform APIs

The first platform-side MVP endpoints are:

- `GET /api/v1/platform/overview`
- `GET /api/v1/platform/tenants`
- `GET /api/v1/platform/tenants/{tenantId}`
- `POST /api/v1/platform/tenants`
- `POST /api/v1/platform/tenants/{tenantId}/features`
- `POST /api/v1/platform/tenants/{tenantId}/plan`
- `POST /api/v1/platform/tenants/{tenantId}/enable`
- `POST /api/v1/platform/tenants/{tenantId}/disable`
- `GET /api/v1/platform/enterprise-reviews`
- `POST /api/v1/platform/enterprise-reviews/{enterpriseId}`
- `GET /api/v1/platform/announcements`
- `POST /api/v1/platform/announcements`

Example feature toggle payload:

```json
{
  "enabledFeatures": ["rfq", "order", "finance"]
}
```

Example tenant plan payload:

```json
{
  "plan": "pro",
  "userLimit": 120
}
```

Example enterprise review payload:

```json
{
  "verified": true,
  "reviewStatus": "approved"
}
```

Example platform announcement payload:

```json
{
  "title": "系统维护通知",
  "content": "6 月 20 日 22:00-23:00 进行例行维护。",
  "audience": "all"
}
```

Platform APIs require a `PLATFORM` login token. Buyer and supplier tokens are rejected by path-level Spring Security rules.

Platform tenant creation, feature toggle changes, plan/user-limit updates, tenant restoration, tenant disablement, enterprise reviews, and announcement publishing write audit log actions `tenant.created`, `tenant.features.updated`, `tenant.plan_updated`, `tenant.enabled`, `tenant.disabled`, `enterprise.reviewed`, and `platform_announcement.published`. Platform announcements are stored in `platform_announcements`, support `all`/`buyer`/`supplier` audiences, and are platform scoped rather than tenant scoped. The local demo seed includes `user-platform-admin` so these audit rows satisfy the `audit_logs.actor_id` foreign key.

Buyer and supplier announcement read endpoints are:

- `GET /api/v1/buyer/announcements`
- `GET /api/v1/supplier/announcements`

Buyer users can read active announcements with audience `all` or `buyer`; supplier users can read active announcements with audience `all` or `supplier`.

Buyer supplier relation maintenance also supports:

- `POST /api/v1/buyer/suppliers/{relationId}/status`
- `POST /api/v1/buyer/suppliers/{relationId}/profile`
- `POST /api/v1/buyer/suppliers/{relationId}/performance`

Manual status changes are deliberately narrow in the MVP: buyers can move a relation to `黑名单`, or restore a `黑名单`/`已驳回` relation to `待准入`. The endpoint does not allow bypassing supplier admission approval by setting `已准入` directly, and records `buyer_supplier_relation.status_changed`.

Profile maintenance updates the private supplier relation's `level` and authorized `categories` inside the current buyer tenant and records `buyer_supplier_relation.profile_updated`.

Performance maintenance updates the private supplier relation's `performanceScore` inside the current buyer tenant. Scores must be between `0` and `100`, and the endpoint records `buyer_supplier_relation.performance_updated`.

## Shared Dictionary API

Authenticated platform, buyer, and supplier users can read shared dictionary entries:

- `GET /api/v1/dictionaries?type=payment_status`

Dictionary entries are global rather than tenant scoped, stored in `dictionaries`, and ordered by `sort_order`. MVP seed data includes `payment_status`, `announcement_audience`, `supplier_user_status`, and `attachment_visibility`.

## RFQ APIs

The first sourcing module exposes buyer-side RFQ APIs:

- `GET /api/v1/buyer/rfqs`
- `POST /api/v1/buyer/rfqs`

RFQ creation requires the current buyer tenant to have the `rfq` feature enabled.

The buyer RFQ list accepts optional `status` and `keyword` filters inside the current buyer tenant. `keyword` matches the RFQ title.

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

## Supplier Profile and Qualification APIs

The supplier-side profile endpoints are:

- `GET /api/v1/supplier/profile`
- `POST /api/v1/supplier/profile`
- `GET /api/v1/supplier/qualifications`
- `POST /api/v1/supplier/qualifications`
- `POST /api/v1/supplier/qualifications/{qualificationId}/status`
- `GET /api/v1/supplier/users`
- `POST /api/v1/supplier/users`
- `POST /api/v1/supplier/users/{userId}/password`
- `POST /api/v1/supplier/users/{userId}/status`

Example qualification payload:

```json
{
  "qualificationType": "营业执照",
  "certificateNo": "Q-2026-001",
  "expiresAt": "2027-12-31",
  "fileName": "license.pdf",
  "storageKey": "suppliers/ent-supplier-sunrise/license.pdf"
}
```

Supplier profile maintenance uses the supplier identity from `Authorization: Bearer <accessToken>`. Suppliers can update their own enterprise `name`, `industry`, `creditCode`, and `legalPerson`; platform-owned review fields such as `verified`, `verifiedStatus`, and `profileStatus` are not accepted from the request. The update records `supplier_profile.updated`.

Supplier qualification APIs use the supplier identity from `Authorization: Bearer <accessToken>`. The request body cannot override `supplierId`; new qualifications are stored in `supplier_qualifications` with status `active`. Suppliers can change only their own qualification status to `active` or `inactive`; the list endpoint returns active qualifications by default.

The supplier qualification list accepts optional `status` and `keyword` filters inside the current supplier enterprise. `keyword` matches qualification type, certificate number, or file name.

Example supplier sub-account payload:

```json
{
  "name": "供应商财务",
  "mobile": "13800009999",
  "email": "supplier.finance@example.com",
  "status": "active",
  "initialPassword": "initial-password"
}
```

Supplier user APIs also use the supplier identity from `Authorization: Bearer <accessToken>`. New users are written to `users.supplier_id`, get a hashed `password_hash`, are assigned the default `supplier` role, and record `supplier_user.created`. Password reset hashes `newPassword` before updating `password_hash`, status changes support only `active` and `inactive`, and both maintenance actions stay scoped to the current supplier while recording `supplier_user.password_reset` or `supplier_user.status_changed`.

The supplier user list accepts optional `status` and `keyword` filters inside the current supplier enterprise. `keyword` matches user name, mobile, or email.

## Supplier Quote APIs

The supplier-side sourcing endpoints are:

- `GET /api/v1/supplier/rfqs`
- `GET /api/v1/supplier/quotes`
- `POST /api/v1/supplier/rfqs/{rfqId}/quotes`

The supplier RFQ invitation list accepts optional `status` and `keyword` filters inside the current supplier enterprise. `keyword` matches the RFQ title.

The supplier quote history list accepts optional `rfqId` and `status` filters inside the current supplier enterprise.

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

Award submission requires a `已提交` quote under the current tenant RFQ. The service updates the RFQ to `定标审批中`, creates an `award_decisions` row with `approved_status = 审批中`, and creates a pending approval task through `ApprovalTaskApplicationService` with `biz_type = rfq_award` and fixed template `TPL_RFQ_AWARD`.

Award approval uses the RFQ ID plus award decision ID. Approval updates the RFQ to `已定标`, stores `awarded_supplier_id`, and changes the award decision to `已通过`. Rejection moves the RFQ back to `报价中` and changes the award decision to `已驳回`.

## Approval Inbox APIs

The buyer-side approval inbox endpoint is:

- `GET /api/v1/buyer/approvals/pending`
- `GET /api/v1/buyer/approvals/templates`
- `POST /api/v1/buyer/approvals/templates/{templateCode}/config`

Approval tasks include `bizType`, `bizId`, and optional `parentBizId`. For `rfq_award`, `bizId` is the award decision ID and `parentBizId` is the RFQ ID. The frontend uses this shape to route demand, supplier admission, and award approvals without deriving backend state in React.

Approval template listing reads rows from the current tenant's `approval_templates` table, including each template status. Approval task creation also resolves the active template from this table and uses its `defaultApproverRoleId` to find the current tenant's default approver. The local seed creates the MVP fixed templates `TPL_PURCHASE_DEMAND`, `TPL_SUPPLIER_ADMISSION`, and `TPL_RFQ_AWARD`, each with `defaultApproverRoleId = role-buyer-owner` and `status = active`. Template config updates can change `defaultApproverRoleId` and `status`; the service validates the role against the current buyer tenant and records `approval_template.config_updated`.

## Purchase Order APIs

The buyer-side order endpoint is:

- `GET /api/v1/buyer/orders`
- `POST /api/v1/buyer/orders`

The buyer order list accepts optional `status`, `supplierId`, and `rfqId` filters inside the current buyer tenant.

Example order payload:

```json
{
  "awardId": "award-approved-001",
  "expectedReceiptDate": "2026-07-10"
}
```

Order creation requires the current tenant to have the `order` feature enabled and an approved award decision in the current tenant. It creates a `purchase_orders` row with status `待供应商确认`. If an order already exists for the same tenant, RFQ, and supplier, the existing order is returned.

## Supplier Order Fulfillment APIs

The supplier-side order fulfillment endpoints are:

- `GET /api/v1/supplier/orders`
- `POST /api/v1/supplier/orders/{orderId}/confirm`
- `GET /api/v1/supplier/deliveries`
- `POST /api/v1/supplier/orders/{orderId}/deliveries`

The supplier order list accepts optional `status` and `rfqId` filters inside the current supplier enterprise.
The supplier delivery list accepts optional `status` and `orderId` filters inside the current supplier enterprise.

Order confirmation uses the supplier identity from `Authorization: Bearer <accessToken>`. The order must belong to the current supplier, its buyer tenant must have the `order` feature enabled, and it must be `待供应商确认`. Confirmation updates the purchase order status to `待发货`.

Example delivery payload:

```json
{
  "carrier": "顺丰速运",
  "trackingNo": "SF1234567890"
}
```

Delivery creation uses the supplier identity from `Authorization: Bearer <accessToken>`. The order must belong to the current supplier, its buyer tenant must have the `order` feature enabled, and it must be `待发货`. MVP delivery creation allows only one delivery per purchase order. Creation stores a `deliveries` row with status `已发货` and updates the purchase order status to `已发货`.

## Buyer Receipt APIs

The buyer-side receipt endpoint is:

- `GET /api/v1/buyer/receipts`
- `POST /api/v1/buyer/orders/{orderId}/receipts`

The buyer receipt list accepts optional `orderId` and `receiverId` filters inside the current buyer tenant.

Example receipt payload:

```json
{
  "result": "验收通过"
}
```

Receipt creation uses the buyer tenant and receiver identity from `Authorization: Bearer <accessToken>`. The current tenant must have the `order` feature enabled, and the order must belong to the current tenant and be `已发货`. Receipt creation requires a current-tenant delivery record with status `已发货` for the order. MVP receipt creation allows only one receipt per purchase order. Creation stores a `receipts` row and updates the purchase order status to `已收货`.

## Finance APIs

The supplier-side invoice endpoint is:

- `GET /api/v1/supplier/invoices`
- `GET /api/v1/supplier/invoices/{invoiceId}/payment-audit-logs`
- `POST /api/v1/supplier/orders/{orderId}/invoices`

The supplier invoice list accepts optional `paymentStatus` and `orderId` filters inside the current supplier enterprise.
The supplier payment audit log list first verifies the invoice belongs to the current supplier enterprise, then returns `invoice.paid` and `invoice.partial_paid` audit entries from the invoice buyer tenant.

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
- `GET /api/v1/buyer/invoices/{invoiceId}/payment-audit-logs`

The buyer invoice list accepts optional `paymentStatus`, `supplierId`, and `orderId` filters inside the current buyer tenant.
The buyer payment audit log list returns current-tenant `invoice.paid` and `invoice.partial_paid` audit entries for the selected invoice.

Example payment payload:

```json
{
  "paymentStatus": "已付款"
}
```

Invoice creation requires the order to belong to the current supplier, be `已收货`, and have the `finance` feature enabled for its buyer tenant. Invoice creation requires `amount` to equal the purchase order amount. MVP invoice creation allows only one invoice per purchase order. New invoices are stored with `payment_status = 待付款`. Payment registration requires the current tenant to have the `finance` feature enabled, is tenant scoped, and updates `invoices.payment_status`. Payment registration rechecks that the invoice amount still equals the purchase order amount. Payment registration rejects invoices whose current-tenant supplier relation is `黑名单`. Repeated registration of the current `部分付款` or `已付款` status is idempotent and does not write another audit log. A `部分付款` invoice can later be completed to `已付款`; an `已付款` invoice cannot be changed back to `部分付款`.

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
