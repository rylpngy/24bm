# 阶段三第二轮执行清单

## 目标

第二轮目标是从后台雏形进入可操作后台。第一轮已经解决“三端后台壳、完整菜单、核心列表、详情和轻量动作入口”，第二轮要把高频业务动作做深，让页面不只是可浏览，还能承接更接近真实业务的填写、校验、状态反馈和 Java 模式联调。

本轮仍坚持采购方主流程优先。平台端和供应商端继续补关键操作，但不抢占采购需求、RFQ、供应商准入、收货验收、发票付款这些主流程工作。

## 范围边界

本轮继续沿用当前前端架构：

- 不新增 react-router，仍使用 `activeRole` / `activeModule` / 选中记录状态切换。
- 继续通过 `services/procurementApiClient.ts` 统一访问 mock 与 Java 数据。
- 优先复用现有组件和视觉风格，不搬旧业务页面。
- 优先补已有 API 或已有数据结构能承接的动作，不为了页面细节提前扩张后端边界。

本轮明确不做：

- 不做商城、竞价、招标、合同和 AI。
- 不做真实支付、税控开票、电子签章。
- 不做 ERP/OA/财务系统深度集成。
- 不做复杂 BI、套餐计费和供应商市场。

## 验收门槛

每个第二轮小提交至少满足：

| 门槛 | 要求 |
| --- | --- |
| 测试优先 | 先补对应页面、数据映射或文档测试，再实现 |
| 前端回归 | `npm test` 通过 |
| 构建回归 | `npm run build` 通过 |
| Java 主流程 | 涉及真实 API 的改动需要执行 `npm run java:smoke` |
| Java 模式逐页联调 | 涉及页面结构、数据映射或状态流的改动，需要复核 `docs/stage-three-java-page-walkthrough.md` 中对应页面 |
| 空态与错误态 | 页面不得出现 `加载失败`、`argument type mismatch`、React runtime error 或横向溢出 |

## 第一批执行任务

第一批任务只处理采购方高频主流程，避免第二轮一开始又铺太散。

| 优先级 | 任务 | 本轮验收点 | 主要文件 |
| --- | --- | --- | --- |
| P0 | 采购需求新建/编辑 | 新建需求表单字段更完整，预算、期望日期、物料行、附件入口和提交审批反馈清晰 | `App.tsx`、`services/procurementApiClient.ts` |
| P0 | RFQ 创建与邀请供应商 | 从已审批需求创建 RFQ 时可选择供应商、截止日期和报价要求；邀请供应商有状态反馈 | `App.tsx`、`services/procurementApiClient.ts` |
| P1 | 供应商准入资料 | 准入动作从理由/品类确认扩展到资质摘要、联系人、授权品类和黑名单提示 | `App.tsx` |
| P1 | 收货验收附件和异常处理 | 登记收货从简单结果扩展到验收备注、异常原因、附件入口和差异处理提示 | `App.tsx` |
| P1 | 发票付款对账入口 | 登记付款补付款备注、对账入口、付款申请状态和三单匹配提示 | `App.tsx` |
| P2 | 详情抽屉和筛选 | 采购需求、RFQ、订单、发票页补常用筛选和更稳定的详情展示结构 | `App.tsx` |

## 已完成的小步验收记录

当前第二轮第一批已经完成一组表单校验和反馈收尾：采购方主流程的高频动作已经从“按钮入口”推进到“可填写、可校验、有反馈”的后台操作形态，并同步补到了平台端企业审核和公告发布。第二轮后续已经开始补详情编辑和 Java 持久化闭环，采购需求草稿编辑、RFQ 报价中编辑、订单预计到货日期编辑、发票付款状态编辑和平台公告生命周期已形成页面细节优化样板。

| 序号 | 增量 | 当前结论 | 验收依据 |
| --- | --- | --- | --- |
| 1 | 需求预算超限提示 | 新建需求表单已校验预算、期望日期、物料行和附件提示，预算超限会给出明确反馈 | `scripts/buyer-demand-create-form-ui.test.ts` |
| 2 | RFQ 邀请校验 | RFQ 创建与邀请供应商已校验准入供应商选择、报价截止日期和报价要求 | `scripts/buyer-rfq-create-form-ui.test.ts` |
| 3 | 定标和订单动作校验 | 报价定标、定标审批和生成订单动作已补定标理由、预计收货日期等必要校验 | `scripts/buyer-award-order-action-forms-ui.test.ts` |
| 4 | 收货和付款登记校验 | 收货登记、异常说明、付款登记和对账提示已从轻量动作升级为可填写表单 | `scripts/buyer-fulfillment-action-forms-ui.test.ts` |
| 5 | 审批处理校验 | 审批通过/驳回已要求处理意见和确认项，避免误操作 | `scripts/buyer-approval-action-forms-ui.test.ts` |
| 6 | 供应商准入校验 | 供应商准入已补准入理由、资质摘要、联系人、授权品类和风险提示确认 | `scripts/buyer-supplier-admission-ui.test.ts` |
| 7 | 平台企业审核校验 | 平台企业审核已补审核意见、资料确认和风险确认，支撑企业入驻审核闭环 | `scripts/platform-enterprise-review-actions-ui.test.ts` |
| 8 | 平台公告发布校验 | 平台公告发布已校验标题、正文、发布范围和发布确认 | `scripts/platform-announcement-publish-form-ui.test.ts` |
| 9 | 详情筛选摘要 | 采购需求、RFQ、订单、收货、发票页已补当前筛选、命中记录、已选详情和清空筛选入口 | `scripts/buyer-detail-filter-summary-ui.test.ts` |
| 10 | 供应商端筛选摘要 | 供应商商机、报价、销售订单、发票应收页已补状态筛选、命中记录和清空筛选入口 | `scripts/supplier-filter-summary-ui.test.ts` |
| 11 | 详情视觉层级 | 采购需求、RFQ、订单、发票详情已统一详情头、摘要事实和分组标题结构 | `scripts/buyer-detail-visual-hierarchy-ui.test.ts` |
| 12 | 三端详情层级 | 平台企业审核、平台公告、供应商报价记录、供应商发票应收卡片已复用详情头和分组结构 | `scripts/cross-role-detail-visual-hierarchy-ui.test.ts` |
| 13 | 动作按钮反馈 | 公告发布、企业审核、供应商报价、订单确认、发货和开票动作已统一禁用、处理中和 `aria-busy` 反馈 | `scripts/action-button-feedback-consistency-ui.test.ts` |
| 14 | 移动端布局收口 | 后台壳、移动端导航、顶部工具栏、工作区选择器和状态筛选器已补窄屏宽度约束，降低横向溢出风险 | `scripts/mobile-layout-overflow-ui.test.ts` |
| 15 | 空态一致性 | 平台待审核、供应商询价邀请筛选无结果和共享列表空态已统一复用 EmptyState | `scripts/empty-state-consistency-ui.test.ts` |
| 16 | 提示态一致性 | 平台、采购方、供应商三端主流程运行结果已统一复用 FeedbackNotice，并按成功、失败、普通信息区分反馈样式 | `scripts/feedback-notice-consistency-ui.test.ts` |
| 17 | 只读页详情入口 | 平台租户、企业审核、公告以及供应商报价、销售订单、应收发票列表已补筛选摘要、已选记录和详情入口 | `scripts/platform-supplier-readonly-detail-affordance-ui.test.ts` |
| 18 | 附件中心入口 | 采购需求、收货验收、发票付款和供应商资质已补附件中心入口、业务对象关联、可见范围和元数据登记边界说明 | `scripts/attachment-center-entry-ui.test.ts` |
| 19 | 消息中心入口 | 采购方首页、审批消息区和供应商工作台已补消息中心入口、未读摘要、通知卡片和空态，供应商通知先由商机、订单、发票状态派生 | `scripts/message-center-entry-ui.test.ts` |
| 20 | 权限差异提示 | 平台、采购方、供应商工作台已补角色能力、不可执行动作、数据边界和 Java/Mock 模式差异说明 | `scripts/permission-boundary-hints-ui.test.ts` |
| 21 | 操作日志筛选 | 采购方审计日志已补对象类型、动作类型组合筛选、命中摘要、已选详情和清空筛选入口 | `scripts/buyer-audit-log-filtering-ui.test.ts` |
| 22 | 供应商档案维护入口 | 供应商企业档案页已补企业档案草稿、联系人维护、授权品类、资质上传入口和附件元数据边界说明 | `scripts/supplier-profile-maintenance-entry-ui.test.ts` |
| 23 | 供应商报价与履约详情 | 供应商报价记录和销售订单页已补选中详情面板，覆盖关联询价、定标结果、发货详情、发票应收和履约轨迹 | `scripts/supplier-quote-order-detail-panels-ui.test.ts` |
| 24 | 平台公告生命周期入口 | 平台公告页已补编辑草稿、撤回公告、影响范围、站内通知和审计留痕说明，Java API 后续扩展 | `scripts/platform-announcement-lifecycle-entry-ui.test.ts` |
| 25 | 平台租户功能开关详情 | 平台租户列表已补选中租户详情面板，覆盖套餐容量、功能开关、多租户数据隔离和审计动作说明 | `scripts/platform-tenant-detail-panel-ui.test.ts` |
| 26 | 平台企业审核详情 | 平台企业审核页已补选中审核详情面板，覆盖入驻资料、风险检查、审核轨迹和处理建议 | `scripts/platform-enterprise-review-detail-panel-ui.test.ts` |
| 27 | 采购需求详情编辑闭环 | 采购需求详情页已补草稿需求编辑、保存、Java 更新接口和刷新后回显反馈，非草稿状态保持不可编辑边界 | `scripts/buyer-demand-detail-edit-ui.test.ts`、`PurchaseDemandUpdateDraftTests` |
| 28 | RFQ 详情编辑闭环 | RFQ 详情页已补报价中询价编辑、邀请供应商重选、Java 更新接口和刷新后回显反馈，定标审批中和已定标状态保持不可编辑边界 | `scripts/buyer-rfq-detail-edit-ui.test.ts`、`RfqUpdateQuotingTests` |
| 29 | 订单详情编辑闭环 | 订单详情页已补预计到货日期编辑、Java 更新接口和刷新后回显反馈，已收货订单保持不可编辑边界 | `scripts/buyer-order-detail-edit-ui.test.ts`、`PurchaseOrderUpdateExpectedReceiptTests` |
| 30 | 发票付款详情编辑闭环 | 发票详情页已补付款状态编辑、Java 更新接口和刷新后回显反馈，已付款发票保持不可编辑边界 | `scripts/buyer-invoice-detail-edit-ui.test.ts`、`InvoicePaymentUpdateDetailTests` |
| 31 | 平台公告生命周期持久化 | 平台公告页已补公告编辑、撤回、Java 更新接口、状态撤回接口和刷新后回显反馈，撤回后公告不再进入活跃列表 | `scripts/platform-announcement-java-persistence-ui.test.ts`、`PlatformAnnouncementLifecycleTests` |
| 32 | 供应商档案维护持久化 | 供应商企业档案页已补企业名称、行业、统一社会信用代码、法人/联系人草稿编辑，保存后调用 Java 供应商档案接口并刷新工作台回显 | `scripts/supplier-profile-java-persistence-ui.test.ts`、`services/procurementApiClient.test.ts` |

## 第二批候选任务

第一批验收后，再进入以下任务：

| 方向 | 任务 | 说明 |
| --- | --- | --- |
| 平台端 | 企业审核持久化、租户功能开关、公告编辑/撤回 | 以 Java API 能力为边界，不提前做套餐计费 |
| 供应商端 | 企业档案编辑、资质上传入口、报价详情、发货详情 | 先保证供应商能完成 RFQ 和订单协同 |
| 通用能力 | 附件中心入口、消息中心、权限差异提示、操作日志筛选 | 围绕主流程补，不单独做大平台能力 |

## 本轮结束标准

第二轮可以收口的最低标准：

1. 采购方主流程页面不再只有轻量入口，关键动作具备可填写表单、校验和反馈。
2. Java 模式逐页联调覆盖采购方主流程页面，页面无加载失败、无运行时错误。
3. 平台端和供应商端至少补齐与采购方主流程直接相关的关键操作。
4. `npm test`、`npm run build` 通过。
5. 涉及 Java API 的提交保留 `npm run java:smoke` 通过记录，或明确说明本机环境阻塞原因。
