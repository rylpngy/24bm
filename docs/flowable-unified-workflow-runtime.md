# Flowable 统一审批运行时

## 决策与边界

采购审批的唯一生产运行时是 `UnifiedWorkflowApplicationService` 和 Flowable。业务服务不能再直接把生产审批写入 `process_instances` 或 `approval_tasks`。`process_instances` 表仅作为已有数据库的历史兼容结构，新实例不再写入。

以下旧实现已从源码删除，不再存在双运行时入口：

- `process.api.ProcessInstanceController`
- `process.application.ProcessInstanceApplicationService`
- `workflow.api.FlowableDemandApprovalController`
- `workflow.application.FlowableDemandApprovalService`

`application.yml` 关闭静态 BPMN 的自动部署。新实例只能由已发布的流程定义版本部署到 Flowable 后启动。

## 配置到运行时

1. 在“流程定义”页面为一个受控业务类型保存表单 Schema 和流程 Schema。
2. 服务端校验字段、候选用户/角色、条件、分支完整性和至少一个审批节点。
3. 发布时生成不可变 `workflow_definition_versions` 记录，并部署对应 BPMN 到 Flowable。
4. 业务提交时按 `业务类型 -> 当前已发布版本 -> Flowable 实例 -> 业务回调` 发起。
5. Flowable 任务完成时，统一写入任务事件、实例状态、审计日志，并调用对应业务完成处理器。

已发布流程的业务类型不能修改；一个租户的一个业务类型只保留一个配置入口，发布会产生新版本而不会覆盖历史版本。禁用定义只阻止新实例，已发起实例继续按启动时绑定的版本办理。

## 支持的业务类型

| 业务类型 | 提交入口 | 完成回调 | 本轮验收状态 |
| --- | --- | --- | --- |
| `purchase_demand` | 采购需求提交审批 | 更新需求为已通过或已驳回 | 已完成真实 Java 闭环 |
| `buyer_supplier_admission` | 供应商准入提交 | 更新合作关系为已准入或已驳回 | 已完成真实 Java 闭环 |
| `rfq_award` | 询价定标提交 | 更新定标决定、报价和询价状态 | 已完成真实 HTTP 闭环（通过/驳回） |
| `contract_approval` | 合同提交审批 | 更新合同为已生效或草案 | 已完成真实 HTTP 闭环（通过/驳回） |
| `payment_request` | 付款申请创建或状态提交 | 更新付款申请和付款批次汇总 | 已完成真实 HTTP 闭环（通过、驳回、再次提交） |
| `payment_batch` | 付款批次提交 | 更新批次为可安排付款或待提交审批 | 已完成真实 HTTP 闭环（通过、驳回、再次提交） |
| `payment_archive_exception` | 归档例外申请 | 更新例外申请审批状态 | 已完成真实 HTTP 正向闭环和例外申请驳回验证 |

“已接通”表示业务 API、前端动态表单入口、统一运行时启动和业务回调均已实现；它不等同于完整业务前置数据场景已经在本机逐项演练。

## 办理权限和审计

- 审批节点支持指定用户、候选角色和发起人部门主管。
- 条件支持业务金额 `$amount`、部门 `$departmentId` 和已定义的表单字段。
- 动态表单只接受已发布 Schema 中的字段；必填、类型和下拉选项均在服务端二次校验。
- 待办查询和办理同时校验当前租户、候选资格、认领人和数据范围。即使用户属于候选角色，超出部门/本人数据范围也看不到、更不能办理任务。
- `workflow_business_instances` 保存业务对象、定义版本、部门、金额、启动表单和业务快照。
- `workflow_task_events` 保存创建、认领、通过、驳回等动作以及实际办理人和意见；统一审计日志同时记录业务事件。

## 主要接口

流程配置与任务办理：

- `GET/POST/PUT /api/v1/buyer/process-definitions`
- `POST /api/v1/buyer/process-definitions/{id}/publish`
- `GET /api/v1/buyer/process-definitions/{id}/versions`
- `GET /api/v1/buyer/workflow/definitions/{businessType}/form`
- `GET /api/v1/buyer/workflow/tasks`
- `POST /api/v1/buyer/workflow/tasks/{taskId}/complete`
- `GET /api/v1/buyer/workflow/instances/{workflowInstanceId}/history`
- `GET /api/v1/buyer/workflow/instances/business/{businessType}/{businessId}/history`
- `GET /api/v1/buyer/workflow/instances?view=pending|processed|initiated|all`

审批详情统一返回业务快照、动态表单值、关联附件、当前任务、发起人/完成人和全量任务事件。前端“审批中心”以待办、已办、我发起、全部实例四类台账呈现，各业务详情页复用同一流程状态组件。

新 Flowable 任务生成时，系统会解析指定办理人、候选用户和候选角色，再根据业务实例数据范围过滤后发送站内“待审批任务”通知。

业务提交接口保留业务基础字段，并接受可选 `formData` 作为已发布动态表单值：采购需求、供应商准入、询价定标、合同审批、付款申请、付款批次和归档例外均已接入。

## 本轮真实验收记录

在隔离数据库 `procurement_saas_workflow_it` 上，以真实 HTTP、PostgreSQL、MyBatis 和 Flowable 验证：

- 采购需求：发布金额条件流程后，需求进入审批中；跨部门候选人待办为零；合规候选人认领并通过后，需求变为已通过；任务历史包含 `created`、`claimed`、`approved` 及办理人和意见。审批详情已实测返回业务快照、自定义表单、关联附件和当前任务。金额大于等于 `100000` 的实际 smoke 数据已命中角色分支，不会再错误要求未命中的部门主管分支配置。
- 组合路由：`java-workflow-routing-smoke.mjs` 在隔离库创建独立测试租户、申请人、候选复核人、部门主管和跨部门候选人。大额需求按“候选角色 → 发起部门主管”两级 Flowable 任务通过；常规需求命中默认部门主管分支；跨部门候选人既看不到大额任务，也会在直接办理时收到 `403`。两条需求最终均由真实业务回调更新为已通过，历史保留每一级办理人和意见。
- 流程台账与通知：同一 HTTP smoke 验证了待办、已办、我发起、全部实例四类台账；角色候选人收到首级任务通知，指定部门主管收到二级通知，跨部门候选人不收到超出数据范围的通知。
- 供应商准入：发布准入流程后，供应商关系进入审批中；候选角色办理后，关系变为已准入；历史同样完整留痕。
- 询价定标：以真实采购方、供应商登录和报价数据完成“关联需求建项 → 供应商报价 → 开标 → 提交定标 → Flowable 候选任务 → 通过/驳回”两条链路。通过后 RFQ 变为已定标、报价变为已中选；驳回后 RFQ 回到已开标、被锁报价恢复为已提交，可重新评标定标。
- 合同审批：由已通过定标创建真实采购订单和合同草案；通过“流程定义配置器”发布含法务复核单号、风险等级的合同流程版本。通过后合同变为已生效；驳回后回到草案待修订；动态表单、候选角色、金额、部门归属和办理意见均可从实例与历史中查询。
- 付款申请与三单匹配：真实订单完成收货、供应商创建发票后，三单台账进入“可申请付款”。smoke 仅在本地隔离库临时制造发票金额差异，确认付款申请被阻断，创建并完成差异处理后恢复申请；脚本以 `finally` 恢复原发票金额并重建台账，失败时也不会遗留测试差异。
- 付款审批与归档：付款申请通过 Flowable 任务办理后，批次才从“付款申请审批中”回到“待提交审批”；未完成申请审批时提交批次会被拒绝。付款申请被驳回时请求变为“付款申请已驳回”、批次变为“付款申请未通过”，重提后可创建新的 Flowable 实例并通过。批次被驳回时回到“待提交审批”，重提后可再次通过；只有通过后才能进入“可安排付款”。本地付款登记后发票变为“已付款”，归档后批次和三单台账均为“已付款归档”。归档例外已完成“申请 → Flowable 通过 → 受控处理 → 关闭”正向链路，并另行验证例外申请驳回。
- 上述七类流程完成后，隔离库中 `approval_tasks`、`process_instances`、`workflow_business_instances(status = processing)` 和 Flowable 运行时任务均为零。

本轮命令验证：

```text
(cd backend-java && mvn -q test)
./node_modules/.bin/tsc -p apps/tenant-portal/tsconfig.json --noEmit
(cd apps/tenant-portal && ../../node_modules/.bin/vite build)
JAVA_SKIP_PLATFORM_SMOKE=1 \
  JAVA_API_BASE_URL=http://localhost:8080 \
  JAVA_SMOKE_DATABASE_URL=postgresql://procurement:procurement@localhost:5432/procurement_saas_workflow_it \
  node scripts/java-local-smoke.mjs
JAVA_API_BASE_URL=http://localhost:8080 \
  JAVA_SMOKE_DATABASE_URL=postgresql://procurement:procurement@localhost:5432/procurement_saas_workflow_it \
  node scripts/java-workflow-routing-smoke.mjs
JAVA_API_BASE_URL=http://localhost:8082 \
  JAVA_SMOKE_DATABASE_URL=postgresql://procurement:procurement@localhost:5432/procurement_saas_demo_smoke \
  pnpm java:smoke
JAVA_API_BASE_URL=http://localhost:8082 \
  JAVA_SMOKE_DATABASE_URL=postgresql://procurement:procurement@localhost:5432/procurement_saas_demo_smoke \
  pnpm java:workflow-smoke
```

后端全量单元/契约/架构测试、前端类型检查与构建、上述隔离库 HTTP smoke 均以各自命令为准。`UnifiedWorkflowRuntimeIT` 在此机器因 Testcontainers 无法连接 Docker API 而被条件跳过；因此真实验收采用上述隔离库 HTTP 联调补足，不将该跳过项标记为通过。2026-08-26 已在全新 `procurement_saas_demo_smoke` 演示库加载 `db/demo` 并执行不跳过平台端的完整 smoke：平台运营、采购方和供应商均可登录并加载工作台，`V245__demo_platform_login_password.sql` 已验证会补齐既有平台身份的本地演示密码。此前仅在刻意未加载 `db/demo` 的 `procurement_saas_workflow_it` 中使用 `JAVA_SKIP_PLATFORM_SMOKE=1`。

## 上线前剩余验收

1. 扩展更复杂的流程组合验收，例如跨部门树数据范围、连续多个条件节点和不同动态表单字段路由；当前已覆盖金额分支、多级、候选角色、部门主管、跨部门数据范围和付款驳回重提。
2. 在目标部署环境启用对象存储和 OIDC/Keycloak；当前本地联调使用自签登录和未连接 MinIO 的降级环境。
3. 导入历史审批时只作为只读历史，不允许回写到已退役的 `process_instances` 结构。
