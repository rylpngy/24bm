# Java 后端架构设计

## 技术栈

- Java 21
- Spring Boot 3
- Spring Security + JWT
- PostgreSQL
- MyBatis / MyBatis-Plus
- Flyway
- Redis
- JUnit 5 + Testcontainers

## 模块边界

- `platform`：平台运营、租户审核、套餐与功能开关。
- `tenant`：采购方企业、租户配置。
- `organization`：采购方租户内组织部门，供需求归属、审批和后续数据权限使用。
- `identity`：用户、角色、权限、登录认证。
- `supplier`：供应商企业档案、资质、采购方私域供应商关系。
- `catalog`：物料与服务目录。
- `demand`：采购需求申请、需求明细、需求审批入口。
- `approval`：固定审批模板和审批任务。
- `sourcing`：RFQ、邀请、报价、比价、定标。
- `order`：采购订单、供应商确认、发货、收货。
- `finance`：发票、付款状态、对账。
- `notification`：站内通知，邮件和短信预留接口。
- `attachment`：资质、需求、报价、发票附件。
- `audit`：操作日志、数据变更留痕。
- `common`：统一响应、异常、租户上下文、基础工具。

## 分层

```text
Controller
  -> Application Service
    -> Domain Service
      -> Repository / Mapper
        -> PostgreSQL
```

## 多租户策略

MVP 采用共享数据库、共享 Schema、`tenant_id` 字段隔离。平台数据、供应商公共企业档案和采购方私域关系分开建模。所有组织部门、采购需求、询价、报价、订单、收货、发票、审批任务、附件和审计数据必须带租户上下文。

## 迁移策略

现有 PostgreSQL 初始表结构已迁移到：

```text
backend-java/src/main/resources/db/migration/V1__initial_schema.sql
```

后续数据库变更只新增 Flyway 版本文件，不直接修改已发布迁移。

## 与前端对接

前端保留 `services/procurementApiClient.ts` 作为 API adapter。Java 后端实现 `/api/v1` REST API 后，前端通过：

```bash
npm run dev:java
```

切换到 Java 后端。

## 认证与身份上下文

Java 后端使用 `/api/v1/auth/login` 作为统一登录入口。登录请求需要传入账号、密码和身份范围，并且身份上下文必须显式匹配：

- `PLATFORM`：平台运营方，不允许携带 `tenantId` 或 `supplierId`。
- `BUYER`：采购方租户用户，必须携带 `tenantId`，不允许携带 `supplierId`。
- `SUPPLIER`：供应商企业用户，必须携带 `supplierId`，不允许携带 `tenantId`。

登录成功后返回 `accessToken`，前端后续请求使用：

```text
Authorization: Bearer <accessToken>
```

旧 Node 原型和前端 demo 阶段仍保留 `X-Tenant-Id`、`X-Supplier-Id`、`X-User-Id` 请求头兼容；Java 正式后端以 JWT claims 中的 `tenantId`、`supplierId`、`userId`、`scope` 作为主身份来源。

## 采购方用户 Java API

采购方用户接口落在 `identity` 模块：

- `GET /api/v1/buyer/roles`：查询当前采购方租户下可分配的 `buyer` 角色及权限。
- `GET /api/v1/buyer/users`：查询当前采购方租户用户。
- `POST /api/v1/buyer/users`：创建当前采购方租户用户。
- `POST /api/v1/buyer/users/{userId}/role`：变更当前采购方租户内用户的 `buyer` 角色。
- `POST /api/v1/buyer/users/{userId}/password`：重置当前采购方租户内用户密码。
- `POST /api/v1/buyer/users/{userId}/status`：启用或停用当前采购方租户内用户。

用户创建的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`，不允许请求体覆盖租户归属。
- 创建前读取 `tenants.user_limit`，并统计当前租户 `users` 数量。
- 当前用户数达到或超过 `user_limit` 时拒绝创建，避免租户超出套餐人数。
- 用户所属 `departmentId` 必须命中当前租户下 `active` 状态的组织部门，防止采购方用户挂靠到跨租户或停用部门。
- 用户角色 `roleId` 必须命中当前租户下 `buyer` 范围的角色，创建成功后写入 `user_roles`，防止采购方用户绑定平台、供应商或其他租户角色。
- 用户创建必须提交 `initialPassword`，后端使用 `PasswordEncoder` 写入 `users.password_hash`，不保存明文密码。
- 角色列表只返回当前租户 `roles.scope = buyer` 的记录和 `permissions`，用于采购方用户创建和后续用户角色维护。
- 角色变更会先校验目标用户属于当前租户，再校验目标角色属于当前租户 `buyer` 范围，随后替换该用户的采购方角色关系并记录 `buyer_user.role_changed` 审计动作。
- 密码重置会先校验目标用户属于当前租户，再使用 `PasswordEncoder` 更新 `users.password_hash` 并记录 `buyer_user.password_reset` 审计动作。
- 状态变更会先校验目标用户属于当前租户，只允许 `active` 或 `inactive`，随后更新 `users.status` 并记录 `buyer_user.status_changed` 审计动作。

## 采购方组织部门 Java API

采购方组织部门接口落在 `organization` 模块：

- `GET /api/v1/buyer/departments`：查询当前采购方租户下 `active` 状态的组织部门。
- `POST /api/v1/buyer/departments`：在当前采购方租户下创建组织部门，初始状态固定为 `active`。
- `POST /api/v1/buyer/departments/{departmentId}/disable`：停用当前租户下未被采购需求引用的组织部门。

查询规则：

- 采购方身份来自 JWT 中的 `tenantId`，不允许请求参数覆盖租户归属。
- 只返回当前租户 `departments.status = active` 的部门，用于采购需求 `departmentId` 选择和后续审批/数据权限扩展。
- 创建部门时租户来自 JWT，不接受请求体传入 `tenantId` 或 `status`；`parentId` 为空表示顶级部门，非空时必须命中当前租户下 `active` 状态的父级部门；创建成功写入 `audit_logs`，动作为 `department.created`。
- 停用部门只允许从 `active` 更新为 `inactive`；若当前租户下已有 `purchase_demands.department_id` 引用该部门，则拒绝停用；停用成功写入 `audit_logs`，动作为 `department.disabled`。
- 供应商和平台 token 不能访问该 buyer 侧接口。

## 采购需求 Java API

第一批 Java 业务接口落在 `demand` 模块：

- `GET /api/v1/buyer/demands`：查询当前采购方租户的需求列表。
- `POST /api/v1/buyer/demands`：创建采购需求和需求明细，初始状态为 `草稿`。
- `POST /api/v1/buyer/demands/{demandId}/submit`：提交审批，将需求状态改为 `审批中`，并创建 `approval_tasks` 记录。

对应数据库表：

- `departments`
- `purchase_demands`
- `purchase_demand_items`
- `approval_tasks`
- `audit_logs`

该模块通过 `TenantAccessGuard` 读取 JWT 派生的租户与用户上下文，不接受前端在请求体中直接传入租户归属。创建采购需求时，`departmentId` 必须命中当前租户下 `active` 状态的 `departments` 记录，防止跨租户组织归属被写入需求。创建采购需求成功后会写入 `audit_logs`，当前动作为 `purchase_demand.created`，目标类型为 `purchase_demand`。

## 操作审计 Java 能力

审计能力落在 `audit` 模块：

- `GET /api/v1/buyer/audit-logs`：采购方查询当前租户最近的操作审计日志。
- `AuditLogApplicationService`：统一记录租户内业务操作。
- `AuditLogMapper`：写入 `audit_logs` 表。

查询规则：

- 查询租户来自 JWT 中的 `tenantId`，不接受请求体覆盖。
- 默认返回最近 50 条，服务端将 `limit` 限制在 1 到 200 之间。
- 查询按 `created_at desc` 排序，并始终带 `tenant_id` 条件。

当前已接入的审计动作：

- `purchase_demand.created`：采购方创建采购需求。
- `purchase_demand.approved` / `purchase_demand.rejected`：采购方审批采购需求。
- `buyer_user.created`：采购方创建租户用户。
- `material.created`：采购方创建物料/服务目录项。
- `buyer_supplier_relation.created`：采购方创建私域供应商关系。
- `buyer_supplier_admission.submitted`：采购方提交供应商准入审批。
- `buyer_supplier_admission.approved` / `buyer_supplier_admission.rejected`：采购方审批供应商准入。
- `rfq_award.submitted`：采购方提交定标审批。
- `rfq_award.approved` / `rfq_award.rejected`：采购方审批定标结果。
- `purchase_order.created`：采购方生成采购订单。
- `purchase_order.confirmed`：供应商确认采购订单。
- `purchase_order.shipped`：供应商提交发货。
- `purchase_order.received`：采购方收货验收。
- `invoice.created`：供应商登记发票。
- `invoice.paid` / `invoice.partial_paid`：采购方登记付款状态。
- `attachment.created`：采购方登记已上传附件元数据并关联业务对象。
- `tenant.created`：平台运营方开通采购方企业租户，并初始化管理员、角色和固定审批模板。
- `tenant.features.updated`：平台运营方更新租户功能开关，审计记录挂到目标租户。
- `tenant.plan_updated`：平台运营方调整租户套餐和用户上限，后续采购方用户创建会继续受 `user_limit` 约束。
- `tenant.enabled`：平台运营方恢复采购方企业租户，审计记录挂到目标租户。
- `tenant.disabled`：平台运营方停用采购方企业租户，审计记录挂到目标租户。
- `enterprise.reviewed`：平台运营方审核企业入驻，审计记录为平台级操作，`tenant_id` 为空。

后续应继续把平台公告发布纳入同一审计入口。

## RFQ 询价 Java API

第二批 Java 业务接口落在 `sourcing` 模块：

- `GET /api/v1/buyer/rfqs`：查询当前采购方租户的 RFQ 列表。
- `POST /api/v1/buyer/rfqs`：从已通过采购需求创建 RFQ，并邀请已准入供应商。

创建 RFQ 的关键校验：

- 请求中的所有 `demandIds` 必须属于当前 `tenantId`。
- 需求状态必须是 `已通过`。
- 请求中的所有 `invitedSupplierIds` 必须在 `buyer_supplier_relations` 中处于 `已准入`。
- 当前租户必须启用 `rfq` 功能开关，否则不能创建 RFQ。
- 创建后的 RFQ 状态为 `报价中`。

对应数据库表：

- `rfqs`
- `rfq_demands`
- `rfq_invites`
- `buyer_supplier_relations`

供应商报价、报价比价、定标和订单生成在后续阶段继续补齐。

## 供应商报价 Java API

第三批 Java 业务接口继续落在 `sourcing` 模块：

- `POST /api/v1/supplier/rfqs/{rfqId}/quotes`：被邀请供应商提交报价。

提交报价的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`，不允许请求体传入供应商归属。
- RFQ 必须能通过 `rfq_invites` 找到当前供应商邀请。
- RFQ 状态必须是 `报价中`。
- 同一供应商在同一 RFQ 下只能存在一个 `已提交` 报价。

对应数据库表：

- `rfqs`
- `rfq_invites`
- `quotes`

后续比价定标会基于 `quotes` 表中 `已提交` 报价生成 `award_decisions`。

## 比价定标 Java API

第四批 Java 业务接口继续落在 `sourcing` 模块：

- `POST /api/v1/buyer/rfqs/{rfqId}/award`：采购方从已提交报价中选择拟中标供应商，并提交定标审批。
- `POST /api/v1/buyer/rfqs/{rfqId}/award/approval`：采购方审批定标结果。

定标的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- RFQ 必须属于当前采购方租户。
- 选中的 `quoteId` 必须属于该 RFQ 和当前租户。
- 报价状态必须是 `已提交`。

定标后的状态流转：

- 提交定标时，`rfqs.status` 更新为 `定标审批中`。
- 提交定标时，`award_decisions.approved_status` 写入 `审批中`，并创建 `approval_tasks` 记录，`biz_type = rfq_award`。
- 定标审批通过时，`rfqs.status` 更新为 `已定标`，`rfqs.awarded_supplier_id` 写入中标供应商，`award_decisions.approved_status` 写入 `已通过`。
- 定标审批驳回时，`rfqs.status` 回到 `报价中`，`award_decisions.approved_status` 写入 `已驳回`。

对应数据库表：

- `rfqs`
- `quotes`
- `award_decisions`
- `approval_tasks`

后续订单模块会基于 `award_decisions` 生成 `purchase_orders`。

## 审批待办 Java API

MVP 审批模块采用固定审批模板，前端通过统一待办入口读取采购方需要处理的审批事项：

- `GET /api/v1/buyer/approvals/pending`：查询当前采购方租户待处理审批任务。
- `GET /api/v1/buyer/approvals/templates`：查询当前 MVP 审批模板。
- `POST /api/v1/buyer/approvals/templates/{templateCode}/config`：更新当前租户审批模板的默认审批角色和启停状态。
- `POST /api/v1/buyer/demands/{demandId}/approval`：审批采购需求。
- `POST /api/v1/buyer/suppliers/{relationId}/approval`：审批供应商准入。
- `POST /api/v1/buyer/rfqs/{rfqId}/award/approval`：审批定标结果。

当前审批类型：

- `purchase_demand`：需求审批，模板编码 `TPL_PURCHASE_DEMAND`，`bizId` 为采购需求 ID。
- `buyer_supplier_admission`：供应商准入审批，模板编码 `TPL_SUPPLIER_ADMISSION`，`bizId` 为采购方私域供应商关系 ID。
- `rfq_award`：定标审批，模板编码 `TPL_RFQ_AWARD`，`bizId` 为定标决策 ID，`parentBizId` 为 RFQ ID。

后端通过 `ApprovalTaskApplicationService` 统一从当前租户 `approval_templates` 表解析 active 审批模板并创建待审批任务，固定使用 `待审批` 初始状态。当前默认审批人按模板配置的 `default_approver_role_id`，从当前租户 active 用户的 `user_roles` 关系中解析；后续可替换为组织角色或可配置审批流。采购需求提交、供应商准入提交和定标提交只负责各自业务状态流转、审计和通知，不再直接写入 `approval_tasks`。

`ApprovalTemplateApplicationService` 从当前租户 `approval_templates` 表读取模板和状态，MVP seed 先内置 `TPL_PURCHASE_DEMAND`、`TPL_SUPPLIER_ADMISSION`、`TPL_RFQ_AWARD` 三类模板。租户管理员可更新模板默认审批角色和 `active`/`inactive` 状态，服务端校验角色必须属于当前采购方租户，并记录 `approval_template.config_updated` 审计日志，为后续审批流可视化配置预留 API 边界。

前端只消费审批待办 DTO，不在页面内推导后端状态。审批通过或驳回后的业务状态以 Java 后端返回和重新拉取的 buyer master data 为准。

## 采购订单 Java API

第五批 Java 业务接口落在 `order` 模块：

- `POST /api/v1/buyer/orders`：采购方基于已通过定标结果生成采购订单。

订单生成的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- 当前租户必须启用 `order` 功能开关，否则不能生成采购订单。
- `awardId` 必须属于当前采购方租户。
- `award_decisions.approved_status` 必须是 `已通过`。
- 同一 `tenantId + rfqId + supplierId` 已有订单时直接返回已有订单，避免重复下单。

订单生成后的状态：

- `purchase_orders.status` 写入 `待供应商确认`。
- `purchase_orders.expected_receipt_date` 来自采购方下单请求。

对应数据库表：

- `award_decisions`
- `purchase_orders`

后续履约模块从供应商确认订单开始，继续推进发货、采购方收货验收、发票和付款状态。

## 供应商确认订单 Java API

第六批 Java 业务接口继续落在 `order` 模块：

- `POST /api/v1/supplier/orders/{orderId}/confirm`：供应商确认采购订单。

确认订单的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`。
- 订单必须属于当前供应商。
- 订单所属采购方租户必须启用 `order` 功能开关。
- 订单状态必须是 `待供应商确认`。

确认后的状态流转：

- `purchase_orders.status` 更新为 `待发货`。

对应数据库表：

- `purchase_orders`

## 供应商发货 Java API

第七批 Java 业务接口继续落在 `order` 模块：

- `POST /api/v1/supplier/orders/{orderId}/deliveries`：供应商提交发货信息。

发货的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`。
- 订单必须属于当前供应商。
- 订单所属采购方租户必须启用 `order` 功能开关。
- 订单状态必须是 `待发货`。

发货后的状态流转：

- `deliveries.status` 写入 `已发货`。
- `purchase_orders.status` 更新为 `已发货`。

对应数据库表：

- `purchase_orders`
- `deliveries`

后续收货模块会基于 `purchase_orders` 和 `deliveries` 创建 `receipts`，并把订单推进到验收完成状态。

## 采购方收货验收 Java API

第八批 Java 业务接口继续落在 `order` 模块：

- `POST /api/v1/buyer/orders/{orderId}/receipts`：采购方对已发货订单进行收货验收。

收货验收的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- 验收人来自 JWT 中的 `userId`。
- 订单必须属于当前采购方租户。
- 当前租户必须启用 `order` 功能开关。
- 订单状态必须是 `已发货`。

收货后的状态流转：

- `receipts.result` 写入验收结果。
- `receipts.receiver_id` 写入当前用户。
- `purchase_orders.status` 更新为 `已收货`。

对应数据库表：

- `purchase_orders`
- `receipts`

后续财务协同模块会在订单已收货后接入发票登记、付款状态和对账记录。

## 财务协同 Java API

第九批 Java 业务接口落在 `finance` 模块：

- `POST /api/v1/supplier/orders/{orderId}/invoices`：供应商对已收货订单登记发票。
- `POST /api/v1/buyer/invoices/{invoiceId}/payments`：采购方登记发票付款状态。

发票登记的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`。
- 订单必须属于当前供应商。
- 订单状态必须是 `已收货`。
- 订单所属采购方租户必须启用 `finance` 功能开关。
- 新发票初始 `payment_status` 为 `待付款`。

付款状态登记的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- 发票必须属于当前采购方租户。
- 当前租户必须启用 `finance` 功能开关。
- 付款状态写入 `invoices.payment_status`。

对应数据库表：

- `purchase_orders`
- `invoices`

## 附件元数据 Java API

第十批 Java 业务接口落在 `attachment` 模块：

- `GET /api/v1/buyer/attachments`：采购方按 `ownerType + ownerId` 查询当前租户业务对象附件。
- `POST /api/v1/buyer/attachments`：采购方登记已上传附件元数据，并关联到需求、报价、发票等业务对象。

当前边界：

- 采购方身份来自 JWT 中的 `tenantId`，上传人来自 JWT 中的 `userId`。
- 请求体只接收 `ownerType`、`ownerId`、`fileName`、`storageKey` 和可选 `visibility`，不接受前端传入 `tenantId`、`uploadedBy` 或 `status`。
- `visibility` 不传时默认 `tenant`，当前支持 `tenant`、`buyer_internal`、`supplier_shared`；新增附件状态由服务端固定为 `active`。
- 查询附件时始终按当前租户和业务对象过滤，并只返回 `active` 状态的附件元数据。
- 当前实现登记附件元数据，不直接处理对象存储直传、病毒扫描、文件预览或下载签名。
- 新增附件会写入 `audit_logs`，动作为 `attachment.created`，目标类型为附件关联的 `ownerType`。

对应数据库表：

- `attachments`
- `audit_logs`

## 站内通知 Java API

第十一批 Java 基础能力落在 `notification` 模块：

- `GET /api/v1/buyer/notifications`：采购方用户查询自己的站内通知。
- `POST /api/v1/buyer/notifications/{notificationId}/read`：采购方用户将自己的通知标记为已读。

当前边界：

- 通知查询使用 JWT 中的 `tenantId + userId`，不允许用户读取同租户其他人的通知。
- 标记已读时同样使用 `tenantId + recipientId + notificationId` 三重条件。
- 查询默认返回最近 50 条，服务端将 `limit` 限制在 1 到 200 之间。
- 采购需求提交审批时会为当前租户启用采购方用户生成站内通知，标题为 `采购需求待审批`。
- RFQ 定标结果提交审批时会为当前租户启用采购方用户生成站内通知，标题为 `定标结果待审批`。
- 供应商确认采购订单时会为当前租户启用采购方用户生成站内通知，标题为 `采购订单已确认`。
- 供应商提交发货时会为当前租户启用采购方用户生成站内通知，标题为 `采购订单已发货`。
- 采购方完成收货验收时会为当前租户启用采购方用户生成站内通知，标题为 `采购订单已收货`。
- MVP 先完成站内通知数据能力，邮件和短信只保留后续集成接口边界。

对应数据库表：

- `notifications`

至此，Java 后端 MVP 主链路已经覆盖需求、询价、报价、定标、订单、发货、收货、发票、付款状态、附件元数据登记和站内通知。
