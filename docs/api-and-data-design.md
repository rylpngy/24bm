# 24Bid 多企业 SaaS 采购系统 API 与数据设计

## 1. 设计目标

本阶段目标是把当前前端原型推进到可开发系统的接口基线。系统按三方角色建模：

- 平台运营方：管理租户、套餐、功能开关、公共供应商企业身份和平台审计。
- 采购方企业：管理组织、用户、私域供应商关系、物料目录、采购需求、询价比价、订单履约和发票付款状态。
- 供应商企业：维护企业档案和资质，接收多采购方询价邀请，提交报价、发货、发票和应收信息。

第一阶段只实现“询价比价闭环”，不实现复杂招标、实时竞价、电子签章、真实支付、税控、ERP/OA/财务深度集成和 AI 智能化。

## 2. 多租户与数据隔离

租户模型：

- `tenants` 表代表采购方租户。
- `enterprises` 表代表平台上的企业身份，包含平台方、采购方、供应商。
- 供应商企业使用平台公共身份，一家供应商可以服务多个采购方。
- 采购方与供应商的准入、分级、品类授权和绩效评价保存在 `buyer_supplier_relations`，按 `tenant_id` 隔离。

隔离规则：

- Java 正式后端通过 `Authorization: Bearer <accessToken>` 中的 JWT claims 获取 `tenantId`、`supplierId`、`userId` 和 `scope`。
- 采购方接口必须从鉴权上下文获取租户范围，不从请求体接收租户归属。
- 供应商接口必须从鉴权上下文获取供应商范围，不从请求体接收供应商归属。
- `X-Tenant-Id`、`X-Supplier-Id`、`X-User-Id` 只保留在 Node 原型和早期 demo 文档中，不作为 Java 正式 API 契约。
- 采购业务表必须带 `tenant_id`，包括需求、询价、报价、订单、发货、收货、发票、附件、通知和审计日志。
- 供应商可以看到自己被邀请的询价、自己提交的报价、自己的订单和发票，但不能看到其它供应商报价明细。
- 平台运营方可以看租户、套餐、企业认证和公共供应商身份，不参与采购方定标业务决策。

## 3. 核心数据表

当前接口草案在 [data/apiContract.ts](../data/apiContract.ts) 中以 `databaseTables` 形式维护，后续后端迁移应以此为第一版范围。

关键表：

- `tenants`：采购方租户、套餐、状态、功能开关。
- `enterprises`：平台企业身份总表。
- `supplier_enterprises`：供应商公共企业档案和认证状态。
- `buyer_supplier_relations`：采购方私域供应商关系。
- `users`、`roles`：账号、角色、权限。
- `materials`：采购方物料/服务目录。
- `purchase_demands`：采购需求。
- `approval_tasks`：固定审批模板下的审批任务和记录。
- `rfqs`、`rfq_invites`：询价项目和邀请供应商。
- `quotes`：供应商报价。
- `award_decisions`：定标结果。
- `purchase_orders`：采购订单。
- `deliveries`：供应商发货。
- `receipts`：采购方收货验收。
- `invoices`：发票和付款状态。
- `attachments`：资质、需求、报价、发票附件。
- `notifications`：站内通知。
- `audit_logs`：业务操作审计日志。

## 4. 第一阶段 API 分组

API 分组在 [data/apiContract.ts](../data/apiContract.ts) 中以 `apiModules` 维护。

平台运营后台：

- 租户列表、租户审核、套餐与功能开关。
- 企业认证和公共供应商身份。
- 平台审计日志。

采购方后台：

- 采购需求、需求提交审批。
- 供应商私域关系和物料目录。
- 询价项目、邀请供应商、报价对比。
- 定标、采购订单、收货验收。
- 发票登记和付款状态。

供应商后台：

- 企业档案、资质、子账号。
- 询价邀请、报价提交。
- 销售订单确认、发货、发票和应收记录。

公共底座：

- 登录鉴权、角色权限。
- 附件中心、站内通知、操作日志、数据字典。

## 5. MVP 主流程接口

第一阶段端到端流程固定如下：

1. `POST /auth/login`：平台方、采购方或供应商登录并获得 JWT。
2. `GET /buyer/suppliers`、`GET /buyer/materials`、`GET /buyer/users`：加载采购方主数据。
3. `POST /buyer/suppliers/{relationId}/submit`、`POST /buyer/suppliers/{relationId}/approval`：供应商准入审批。
4. `POST /buyer/demands`：采购方创建采购需求。
5. `POST /buyer/demands/{demandId}/submit`、`POST /buyer/demands/{demandId}/approval`：提交并审批采购需求。
6. `GET /buyer/approvals/pending`、`GET /buyer/audit-logs`：加载需求、供应商准入、定标审批待办和当前租户操作审计日志。
7. `POST /buyer/rfqs`：从已通过需求创建询价。
8. `GET /supplier/rfqs`、`POST /supplier/rfqs/{rfqId}/quotes`：供应商查看询价邀请并提交报价。
9. `POST /buyer/rfqs/{rfqId}/award`、`POST /buyer/rfqs/{rfqId}/award/approval`：提交并审批定标结果。
10. `GET /buyer/orders`、`POST /buyer/orders`：加载采购方订单并根据已通过定标结果生成采购订单。
11. `GET /supplier/orders`、`POST /supplier/orders/{orderId}/confirm`、`POST /supplier/orders/{orderId}/deliveries`：供应商查看销售订单、确认订单并提交发货信息。
12. `POST /buyer/orders/{orderId}/receipts`：采购方收货验收。
13. `GET /supplier/quotes`、`GET /supplier/invoices`：供应商查看报价历史和应收发票。
14. `GET /buyer/invoices`、`POST /supplier/orders/{orderId}/invoices`：采购方查看发票付款列表，供应商登记发票。
15. `POST /buyer/invoices/{invoiceId}/payments`：采购方登记付款状态。

这些端点在 `mvpFlowEndpoints` 中维护，`buildOpenApiDraft()` 会生成 OpenAPI 3.1 草案对象。

## 6. 状态流

采购需求：

- `草稿` -> `审批中` -> `已通过` / `已驳回`

询价：

- `报价中` -> `定标审批中` -> `已定标` / `报价中`

报价：

- `待提交` -> `已提交` / `已撤回` / `已失效`

订单：

- `待供应商确认` -> `待发货` -> `已发货` -> `已收货`

付款：

- `待付款` -> `部分付款` -> `已付款`

## 7. 权限与校验规则

必须校验：

- 采购方用户只能访问自己 `tenant_id` 下的业务数据。
- 供应商用户只能访问自己 `supplier_id` 下被邀请或已产生业务关系的数据。
- 供应商报价前必须存在有效 `rfq_invites`。
- 定标供应商必须已经提交有效报价。
- 订单必须由已定标 RFQ 生成。
- 发货必须由订单供应商提交。
- 收货和付款状态只能由采购方租户内授权角色登记。

建议第一版角色：

- 平台管理员
- 采购方管理员
- 采购经理
- 需求申请人
- 财务复核
- 供应商管理员
- 供应商业务员

## 8. 后端落地顺序

建议下一步按以下顺序实现：

1. 初始化后端项目、数据库连接和迁移框架。
2. 实现租户、企业、用户、角色、鉴权中间件。
3. 实现 `tenant_id` / `supplier_id` 作用域中间件。
4. 实现物料、供应商关系、采购需求。
5. 实现 RFQ、邀请、报价、定标。
6. 实现订单、发货、收货。
7. 实现发票、付款状态、站内通知、附件元数据。
8. 前端新增 API adapter，把当前 mock 模型替换成接口调用。

## 9. 前端联调策略

当前前端使用 [data/procurementModel.ts](../data/procurementModel.ts) 提供 mock 业务数据。后续应新增 `services/apiClient.ts` 和 `services/mockApiClient.ts`：

- 开发早期默认使用 mock adapter。
- 后端接口完成后切换到 real adapter。
- 页面组件不直接读取 mock 数据，只调用统一 API client。
- 保留现有模型测试，继续补充 API adapter 测试。
