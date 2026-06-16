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
- `buyer`：采购方工作台聚合视图，汇总待办、主数据、审批、通知和业务进度。
- `sourcing`：RFQ、邀请、报价、比价、定标。
- `order`：采购订单、供应商确认、发货、收货。
- `finance`：发票、付款状态、对账。
- `notification`：站内通知，邮件和短信预留接口。
- `attachment`：资质、需求、报价、发票附件。
- `audit`：操作日志、数据变更留痕。
- `dictionary`：公共数据字典。
- `common`：统一响应、异常、租户上下文、基础工具。

## 分层

```text
Controller
  -> Application Service
    -> Domain Service
      -> Repository / Mapper
        -> PostgreSQL
```

当前后端按业务上下文拆包，每个顶层业务包都通过 `package-info.java` 固化边界说明。`BackendModuleArchitectureTests` 会检查这些包级说明，并守护两条基础分层规则：领域层不依赖 Spring Web / MyBatis 基础设施，API 层不直接依赖 Mapper，避免后续迭代把控制器、应用服务、领域对象和持久化实现重新揉在一起。

采购方工作台属于跨模块聚合入口，`BuyerWorkspaceApplicationService` 只负责调用各业务应用服务并组装响应；待办数量等展示型汇总规则下沉到 `BuyerTodoSummaryAssembler`，避免工作台服务承载采购需求、询价、订单和财务模块的业务状态细节。

供应商工作台采用同样边界：`SupplierWorkspaceApplicationService` 只聚合供应商档案、商机、报价、订单、发票和通知；报价、确认订单、发货和应收等展示型待办规则由 `SupplierTodoSummaryAssembler` 承接。

工作台待办汇总和已落地的 RFQ、订单、发票状态机服务使用业务域状态常量：RFQ 状态在 `RfqStatus`，采购订单状态在 `PurchaseOrderStatus`，发票付款状态在 `InvoicePaymentStatus`。后续新增状态流转时应优先扩展这些常量，避免中文状态值重新散落在应用服务中。

发票付款状态流转由 `InvoicePaymentStatusTransition` 承接，集中判断支持的付款目标、幂等登记和 `待付款 -> 部分付款/已付款 -> 已付款` 的合法路径。`PaymentApplicationService` 只编排租户校验、功能开关、金额匹配、供应商黑名单、审计和通知。

订单履约动作的状态准入由 `PurchaseOrderStatusTransition` 承接，集中判断供应商确认、供应商发货和采购方收货对应的当前状态要求。`PurchaseOrderApplicationService`、`DeliveryApplicationService`、`ReceiptApplicationService` 保留租户/供应商范围、功能开关、单据唯一性、原子状态更新、审计和通知编排。

定标审批状态流转由 `RfqAwardStatusTransition` 承接，集中判断 `报价中` 才能提交定标、`定标审批中` 才能复核，以及审批通过落到 `已定标`、驳回回到 `报价中`。`AwardApplicationService` 保留报价有效性、审批任务、定标记录、原子更新、审计和通知编排。

RFQ 寻源准入状态由 `RfqSourcingStatusTransition` 承接，集中判断采购需求必须 `已通过` 才能创建 RFQ、RFQ 必须 `报价中` 才能接收供应商报价。`RfqApplicationService` 和 `QuoteApplicationService` 保留租户/供应商上下文、功能开关、供应商准入、邀请关系、重复报价和单据写入编排。

采购需求审批状态流转由 `PurchaseDemandApprovalStatusTransition` 承接，集中判断 `草稿` 才能提交审批、`审批中` 才能复核，以及审批通过落到 `已通过`、驳回落到 `已驳回`。`PurchaseDemandApplicationService` 保留部门校验、明细写入、审批任务、审计和通知编排。

供应商准入审批状态流转由 `BuyerSupplierAdmissionStatusTransition` 承接，集中判断 `待准入` 才能提交准入审批、`准入审批中` 才能复核，以及审批通过落到 `已准入`、驳回落到 `已驳回`。`BuyerSupplierApplicationService` 保留供应商关系资料、手动拉黑/恢复、绩效、审批任务、审计和通知编排。

供应商手动状态变更由 `BuyerSupplierManualStatusTransition` 承接，集中判断仅支持拉黑和恢复待准入、准入审批中不能手动变更、只有黑名单或已驳回可恢复待准入。`BuyerSupplierApplicationService` 保留关系查询、原子更新、审计编排。

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
- 状态变更会先校验目标用户属于当前租户，目标状态规则由 `BuyerUserStatusTransition` 承接，只允许 `active` 或 `inactive`，随后更新 `users.status` 并记录 `buyer_user.status_changed` 审计动作。
- 采购方用户创建、角色变更、密码重置和状态变更的审计动作统一由 `BuyerUserAuditAction` 定义，避免身份应用服务散落审计 action 字符串。

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

部门创建、父级校验和停用状态更新统一使用 `DepartmentStatus.ACTIVE` / `DepartmentStatus.INACTIVE`，避免组织应用服务散落部门状态字符串。
部门创建和停用审计动作统一由 `DepartmentAuditAction` 定义，避免组织应用服务散落审计 action 字符串。

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

该模块通过 `TenantAccessGuard` 读取 JWT 派生的租户与用户上下文，不接受前端在请求体中直接传入租户归属。采购需求列表始终按当前 `tenantId` 过滤，并支持可选 `status`、`departmentId`、`keyword` 查询条件；`keyword` 匹配需求标题。创建采购需求时，`departmentId` 必须命中当前租户下 `active` 状态的 `departments` 记录，防止跨租户组织归属被写入需求。创建采购需求成功后会写入 `audit_logs`，当前动作为 `purchase_demand.created`，目标类型为 `purchase_demand`。
采购需求创建、审批通过和审批驳回审计动作统一由 `PurchaseDemandAuditAction` 定义，避免采购需求应用服务散落审计 action 字符串。

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
- `material.updated`：采购方维护物料/服务目录项。
- `buyer_supplier_relation.created`：采购方创建私域供应商关系。
- `buyer_supplier_relation.profile_updated`：采购方维护供应商分级和授权品类。
- `buyer_supplier_relation.performance_updated`：采购方维护供应商绩效评分。
- `buyer_supplier_relation.status_changed`：采购方拉黑供应商或恢复到待准入状态。
- `buyer_supplier_admission.submitted`：采购方提交供应商准入审批。
- `buyer_supplier_admission.approved` / `buyer_supplier_admission.rejected`：采购方审批供应商准入。
- `supplier_profile.updated`：供应商维护本企业档案基础信息。
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
- `platform_announcement.published`：平台运营方发布公告，审计记录为平台级操作，`tenant_id` 为空。

平台租户创建、启用、停用和运营汇总统一使用 `PlatformTenantStatus.ACTIVE` / `PlatformTenantStatus.INACTIVE`，避免平台应用服务继续散落租户状态字符串。
平台租户创建、功能开关、套餐调整、启用和停用审计动作统一由 `PlatformTenantAuditAction` 定义，避免平台租户应用服务散落审计 action 字符串。
订单生成、供应商确认、发货和收货审计动作统一由 `PurchaseOrderAuditAction` 定义，避免订单履约应用服务散落审计 action 字符串。
发票登记、已付款和部分付款审计动作统一由 `InvoiceAuditAction` 定义，避免财务应用服务散落审计 action 字符串。
定标提交、审批通过和审批驳回审计动作统一由 `RfqAwardAuditAction` 定义，避免定标应用服务散落审计 action 字符串。

## 平台公告 Java API

平台公告接口落在 `platform` 模块：

- `GET /api/v1/platform/announcements`：平台运营方查看 active 公告。
- `POST /api/v1/platform/announcements`：平台运营方发布公告。
- `GET /api/v1/buyer/announcements`：采购方查看面向全部或采购方的 active 公告。
- `GET /api/v1/supplier/announcements`：供应商查看面向全部或供应商的 active 公告。

当前边界：

- 平台身份来自 JWT 中的 `scope = PLATFORM`，采购方和供应商 token 不能访问。
- 公告是平台公共资源，不绑定采购方 `tenant_id`。
- `audience` 目标规则由 `PlatformAnnouncementAudiencePolicy` 承接，当前支持 `all`、`buyer`、`supplier`。
- 采购方只读取 `all`/`buyer`，供应商只读取 `all`/`supplier`。
- 新公告状态由服务端固定为 `active`，发布人来自 JWT 中的 `userId`。
- 发布公告写入 `audit_logs`，动作为 `platform_announcement.published`，且 `tenant_id` 为空。

对应数据库表：

- `platform_announcements`
- `audit_logs`

## 数据字典 Java API

公共数据字典接口落在 `dictionary` 模块：

- `GET /api/v1/dictionaries?type=payment_status`：按字典类型读取 active 字典项。

当前边界：

- 字典是共享底座资源，不绑定采购方 `tenant_id` 或供应商 `supplier_id`。
- 所有已登录平台、采购方、供应商用户均可读取；匿名用户不能读取。
- 查询结果按 `sort_order, code` 排序。
- MVP 初始内置 `payment_status`、`announcement_audience`、`supplier_user_status`、`attachment_visibility`。

对应数据库表：

- `dictionaries`

## RFQ 询价 Java API

第二批 Java 业务接口落在 `sourcing` 模块：

- `GET /api/v1/buyer/rfqs`：查询当前采购方租户的 RFQ 列表。
- `POST /api/v1/buyer/rfqs`：从已通过采购需求创建 RFQ，并邀请已准入供应商。

创建 RFQ 的关键校验：

- RFQ 列表始终按当前 `tenantId` 过滤，并支持可选 `status`、`keyword` 查询条件；`keyword` 匹配询价标题。
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

供应商报价、比价定标和订单生成已在后续 `sourcing`、`approval`、`order` 模块承接，形成从 RFQ 到采购订单的主链路。

## 供应商报价 Java API

第三批 Java 业务接口继续落在 `sourcing` 模块：

- `GET /api/v1/supplier/profile`：供应商读取本企业档案。
- `POST /api/v1/supplier/profile`：供应商维护本企业档案基础信息。
- `GET /api/v1/supplier/qualifications`：供应商查询本企业资质附件元数据。
- `POST /api/v1/supplier/qualifications`：供应商登记本企业资质附件元数据。
- `POST /api/v1/supplier/qualifications/{qualificationId}/status`：供应商启用或停用本企业资质。
- `GET /api/v1/supplier/users`：供应商查询本企业子账号。
- `POST /api/v1/supplier/users`：供应商创建本企业子账号。
- `POST /api/v1/supplier/users/{userId}/password`：供应商重置本企业子账号密码。
- `POST /api/v1/supplier/users/{userId}/status`：供应商启用或停用本企业子账号。
- `POST /api/v1/supplier/rfqs/{rfqId}/quotes`：被邀请供应商提交报价。

提交报价的关键校验：

- 供应商 RFQ 邀请列表始终按当前 `supplierId` 和 `rfq_invites.invite_status = 已邀请` 过滤，并支持可选 `status`、`keyword` 查询条件；`keyword` 匹配询价标题。
- 供应商报价历史列表始终按当前 `supplierId` 过滤，并支持可选 `rfqId`、`status` 查询条件。
- 供应商档案维护的供应商身份来自 JWT 中的 `supplierId`，只允许更新 `enterprises.name`、`enterprises.industry`、`supplier_enterprises.credit_code`、`supplier_enterprises.legal_person`，不允许请求体覆盖审核、认证或档案状态。
- 供应商资质接口的供应商身份来自 JWT 中的 `supplierId`，请求体不允许覆盖供应商归属；资质状态维护只允许当前供应商把本企业资质切换为 `active` 或 `inactive`。
- 供应商资质存入公共供应商维度表 `supplier_qualifications`，不绑定采购方租户；采购方私域准入状态仍由 `buyer_supplier_relations` 隔离。
- 供应商资质列表始终按当前 `supplierId` 过滤，默认只返回 `active` 资质，并支持可选 `status`、`keyword` 查询条件；资质状态目标规则由 `SupplierQualificationStatusTransition` 承接，只允许 `active`/`inactive`，`keyword` 匹配资质类型、证书编号或文件名。
- 供应商子账号写入 `users.supplier_id`，不允许请求体覆盖供应商归属；创建时使用 `PasswordEncoder` 写入 `password_hash`，默认绑定 `scope = supplier` 角色并记录 `supplier_user.created`。
- 供应商子账号密码重置和状态变更都以当前 JWT 的 `supplierId` 过滤目标用户；密码重置只写入哈希后的 `newPassword`，状态目标规则由 `SupplierUserStatusTransition` 承接，只允许 `active`/`inactive`，并分别记录 `supplier_user.password_reset`、`supplier_user.status_changed`。
- 供应商子账号创建、密码重置和状态变更的审计动作统一由 `SupplierUserAuditAction` 定义，避免供应商应用服务散落审计 action 字符串。
- 供应商子账号列表始终按当前 `supplierId` 过滤，并支持可选 `status`、`keyword` 查询条件；`keyword` 匹配姓名、手机号或邮箱。
- 供应商身份来自 JWT 中的 `supplierId`，不允许请求体传入供应商归属。
- RFQ 必须能通过 `rfq_invites` 找到当前供应商邀请。
- RFQ 状态必须是 `报价中`。
- 同一供应商在同一 RFQ 下只能存在一个 `已提交` 报价。

对应数据库表：

- `rfqs`
- `rfq_invites`
- `quotes`

比价定标基于 `quotes` 表中 `已提交` 报价生成 `award_decisions`，并通过固定审批模板进入定标审批。

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

订单模块基于已通过的 `award_decisions` 生成 `purchase_orders`，并把订单推进到供应商确认节点。

## 审批待办 Java API

MVP 审批模块采用固定审批模板，前端通过统一待办入口读取采购方需要处理的审批事项：

- `GET /api/v1/buyer/approvals/pending`：查询当前采购方租户待处理审批任务。
- `GET /api/v1/buyer/approvals/recent`：查询当前采购方租户最近已通过/驳回审批记录，按处理时间倒序返回。
- `GET /api/v1/buyer/approvals/templates`：查询当前 MVP 审批模板。
- `POST /api/v1/buyer/approvals/templates/{templateCode}/config`：更新当前租户审批模板的默认审批角色和启停状态。
- `POST /api/v1/buyer/demands/{demandId}/approval`：审批采购需求。
- `POST /api/v1/buyer/suppliers/{relationId}/approval`：审批供应商准入。
- `POST /api/v1/buyer/suppliers/{relationId}/status`：拉黑供应商，或将黑名单/驳回关系恢复为待准入。
- `POST /api/v1/buyer/suppliers/{relationId}/profile`：维护私域供应商分级和授权品类。
- `POST /api/v1/buyer/suppliers/{relationId}/performance`：维护私域供应商绩效评分。
- `POST /api/v1/buyer/rfqs/{rfqId}/award/approval`：审批定标结果。

当前审批类型：

- `purchase_demand`：需求审批，模板编码 `TPL_PURCHASE_DEMAND`，`bizId` 为采购需求 ID。
- `buyer_supplier_admission`：供应商准入审批，模板编码 `TPL_SUPPLIER_ADMISSION`，`bizId` 为采购方私域供应商关系 ID。
- `rfq_award`：定标审批，模板编码 `TPL_RFQ_AWARD`，`bizId` 为定标决策 ID，`parentBizId` 为 RFQ ID。

供应商关系状态维护边界：

- 采购方供应商库列表始终按当前 `tenantId` 过滤，并支持可选 `status`、`level`、`category`、`keyword` 查询条件；`category` 匹配授权品类数组，`keyword` 匹配供应商名称或供应商 ID。
- 采购方物料/服务目录列表始终按当前 `tenantId` 过滤，并支持可选 `category`、`keyword` 查询条件；`keyword` 匹配物料编码或名称。
- 采购方用户列表始终按当前 `tenantId` 过滤，并支持可选 `status`、`departmentId`、`keyword` 查询条件；`keyword` 匹配姓名、手机号或邮箱。
- 手工状态维护不允许直接设置 `已准入`，避免绕过准入审批。
- 手工状态维护支持将关系改为 `黑名单`。
- `黑名单` 或 `已驳回` 可恢复为 `待准入`，之后重新提交准入审批。
- `准入审批中` 关系不允许手工变更，避免与审批任务状态冲突。
- 分级和授权品类维护始终按当前采购方 `tenantId` 过滤关系，只更新 `level` 和 `categories`，不改变准入状态。
- 绩效评分维护始终按当前采购方 `tenantId` 过滤关系，只更新 `performance_score`，评分范围为 `0` 到 `100`。

后端通过 `ApprovalTaskApplicationService` 统一从当前租户 `approval_templates` 表解析 active 审批模板并创建待审批任务，初始状态统一使用 `ApprovalStatus.PENDING`，当前对应状态值 `待审批`。当前默认审批人按模板配置的 `default_approver_role_id`，从当前租户 active 用户的 `user_roles` 关系中解析；后续可替换为组织角色或可配置审批流。采购需求提交、供应商准入提交和定标提交只负责各自业务状态流转、审计和通知，不再直接写入 `approval_tasks`。

`ApprovalTemplateApplicationService` 从当前租户 `approval_templates` 表读取模板和状态，MVP seed 先内置 `TPL_PURCHASE_DEMAND`、`TPL_SUPPLIER_ADMISSION`、`TPL_RFQ_AWARD` 三类模板。租户管理员可更新模板默认审批角色和 `active`/`inactive` 状态，模板状态目标规则由 `ApprovalTemplateStatusTransition` 承接，服务端校验角色必须属于当前采购方租户，并记录 `approval_template.config_updated` 审计日志，为后续审批流可视化配置预留 API 边界。

前端只消费审批待办 DTO，不在页面内推导后端状态。审批通过或驳回后的业务状态以 Java 后端返回和重新拉取的 buyer master data 为准。

## 采购订单 Java API

第五批 Java 业务接口落在 `order` 模块：

- `POST /api/v1/buyer/orders`：采购方基于已通过定标结果生成采购订单。

订单生成的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- 采购方订单列表始终按当前 `tenantId` 过滤，并支持可选 `status`、`supplierId`、`rfqId` 查询条件。
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

履约模块从供应商确认订单开始，已串起发货、采购方收货验收、发票登记和付款状态。

## 供应商确认订单 Java API

第六批 Java 业务接口继续落在 `order` 模块：

- `POST /api/v1/supplier/orders/{orderId}/confirm`：供应商确认采购订单。

确认订单的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`。
- 供应商订单列表始终按当前 `supplierId` 过滤，并支持可选 `status`、`rfqId` 查询条件。
- 订单必须属于当前供应商。
- 订单所属采购方租户必须启用 `order` 功能开关。
- 订单状态必须是 `待供应商确认`。

确认后的状态流转：

- `purchase_orders.status` 更新为 `待发货`。

对应数据库表：

- `purchase_orders`

## 供应商发货 Java API

第七批 Java 业务接口继续落在 `order` 模块：

- `GET /api/v1/supplier/deliveries`：供应商查看发货记录列表。
- `POST /api/v1/supplier/orders/{orderId}/deliveries`：供应商提交发货信息。

发货的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`。
- 供应商发货记录列表始终按当前 `supplierId` 过滤，并支持可选 `status`、`orderId` 查询条件。
- 订单必须属于当前供应商。
- 订单所属采购方租户必须启用 `order` 功能开关。
- 订单状态必须是 `待发货`。
- MVP 阶段同一采购订单只能登记一条发货记录，数据库通过 `tenant_id + order_id` 唯一约束兜底。

发货后的状态流转：

- `deliveries.status` 写入 `已发货`。
- `purchase_orders.status` 更新为 `已发货`。

对应数据库表：

- `purchase_orders`
- `deliveries`

收货模块基于 `purchase_orders` 和 `deliveries` 创建 `receipts`，并把订单推进到验收完成状态。

## 采购方收货验收 Java API

第八批 Java 业务接口继续落在 `order` 模块：

- `GET /api/v1/buyer/receipts`：采购方查看收货记录列表。
- `POST /api/v1/buyer/orders/{orderId}/receipts`：采购方对已发货订单进行收货验收。

收货验收的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- 采购方收货记录列表始终按当前 `tenantId` 过滤，并支持可选 `orderId`、`receiverId` 查询条件。
- 验收人来自 JWT 中的 `userId`。
- 订单必须属于当前采购方租户。
- 当前租户必须启用 `order` 功能开关。
- 订单状态必须是 `已发货`。
- 当前租户下该订单必须存在状态为 `已发货` 的发货记录，避免仅凭订单状态绕过发货事实校验。
- MVP 阶段同一采购订单只能登记一条收货记录，数据库通过 `tenant_id + order_id` 唯一约束兜底。

收货后的状态流转：

- `receipts.result` 写入验收结果。
- `receipts.receiver_id` 写入当前用户。
- `purchase_orders.status` 更新为 `已收货`。

对应数据库表：

- `purchase_orders`
- `receipts`

财务协同模块在订单已收货后接入发票登记和付款状态；对账记录仍保留为后续财务深化能力。

## 财务协同 Java API

第九批 Java 业务接口落在 `finance` 模块：

- `GET /api/v1/buyer/invoices`：采购方查看发票付款列表。
- `POST /api/v1/supplier/orders/{orderId}/invoices`：供应商对已收货订单登记发票。
- `POST /api/v1/buyer/invoices/{invoiceId}/payments`：采购方登记发票付款状态。
- `GET /api/v1/buyer/invoices/{invoiceId}/payment-audit-logs`：采购方查看发票付款操作审计明细。
- `GET /api/v1/supplier/invoices/{invoiceId}/payment-audit-logs`：供应商查看应收发票付款操作审计明细。

发票登记的关键校验：

- 供应商身份来自 JWT 中的 `supplierId`。
- 供应商发票列表始终按当前 `supplierId` 过滤，并支持可选 `paymentStatus`、`orderId` 查询条件。
- 供应商付款审计明细必须先验证发票属于当前 `supplierId`，再按该发票的采购方 `tenantId` 读取付款审计记录。
- 订单必须属于当前供应商。
- 订单状态必须是 `已收货`。
- 订单所属采购方租户必须启用 `finance` 功能开关。
- 发票金额必须等于采购订单金额，作为三单匹配前的基础金额一致性校验。
- MVP 阶段同一采购订单只能登记一张发票，数据库通过 `tenant_id + order_id` 唯一约束兜底。
- 新发票初始 `payment_status` 为 `待付款`。

付款状态登记的关键校验：

- 采购方身份来自 JWT 中的 `tenantId`。
- 采购方发票列表始终按当前 `tenantId` 过滤，并支持可选 `paymentStatus`、`supplierId`、`orderId` 查询条件。
- 发票必须属于当前采购方租户。
- 当前租户必须启用 `finance` 功能开关。
- 付款登记前会重新校验发票金额仍等于采购订单金额，防止绕过发票创建入口或中途数据漂移。
- 发票供应商在当前采购方私域供应商关系中不能是 `黑名单`。
- `待付款` 可登记为 `部分付款` 或 `已付款`。
- `部分付款` 可继续登记为 `已付款`，重复登记当前 `部分付款` / `已付款` 状态直接返回当前发票，不重复写审计。
- `已付款` 不允许回退为 `部分付款`。
- 付款状态写入 `invoices.payment_status`。
- 付款审计明细复用 `audit_logs`，仅返回当前租户下目标类型为 `invoice` 且动作为 `invoice.paid` / `invoice.partial_paid` 的记录。

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

新增附件状态统一使用 `AttachmentStatus.ACTIVE`，避免附件应用服务散落附件状态字符串。

对应数据库表：

- `attachments`
- `audit_logs`

## 站内通知 Java API

第十一批 Java 基础能力落在 `notification` 模块：

- `GET /api/v1/buyer/notifications`：采购方用户查询自己的站内通知。
- `POST /api/v1/buyer/notifications/{notificationId}/read`：采购方用户将自己的通知标记为已读。
- `GET /api/v1/supplier/notifications`：供应商用户查询自己的站内通知。
- `POST /api/v1/supplier/notifications/{notificationId}/read`：供应商用户将自己的通知标记为已读。

当前边界：

- 通知查询使用 JWT 中的 `tenantId + userId`，不允许用户读取同租户其他人的通知。
- 标记已读时同样使用 `tenantId + recipientId + notificationId` 三重条件。
- 供应商通知查询使用 JWT 中的 `supplierId + userId`，按当前 `recipient_id` 汇总多采购方业务通知；`notifications.tenant_id` 表示该通知来源的采购方租户。
- 供应商标记已读使用 `recipientId + notificationId` 条件，不允许供应商用户读取或标记其他用户的通知。
- 查询默认返回最近 50 条，服务端将 `limit` 限制在 1 到 200 之间。
- 采购需求提交审批时会为当前租户启用采购方用户生成站内通知，标题为 `采购需求待审批`。
- RFQ 定标结果提交审批时会为当前租户启用采购方用户生成站内通知，标题为 `定标结果待审批`。
- 供应商确认采购订单时会为当前租户启用采购方用户生成站内通知，标题为 `采购订单已确认`。
- 供应商提交发货时会为当前租户启用采购方用户生成站内通知，标题为 `采购订单已发货`。
- 采购方完成收货验收时会为当前租户启用采购方用户生成站内通知，标题为 `采购订单已收货`。
- 供应商登记发票时会为订单所属采购方租户启用采购方用户生成站内通知，标题为 `供应商已登记发票`。
- 采购方登记付款状态时会为发票供应商企业启用供应商用户生成站内通知，标题为 `发票已付款` 或 `发票部分付款`。
- 通知接收人过滤统一使用 `NotificationRecipientStatus.ENABLED`，当前对应用户状态值 `启用`。
- MVP 先完成站内通知数据能力，邮件和短信只保留后续集成接口边界。

对应数据库表：

- `notifications`

至此，Java 后端 MVP 主链路已经覆盖需求、询价、报价、定标、订单、发货、收货、发票、付款状态、附件元数据登记和站内通知。当前履约、发票和付款阶段的状态机、唯一性约束与后续三单匹配入口见 `docs/java-backend-stage-checklist.md`。
