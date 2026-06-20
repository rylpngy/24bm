# 阶段三第一轮后台雏形验收清单

## 验收目标

阶段三第一轮目标不是新增复杂业务能力，而是把 `http://localhost:3000/` 从“三个工作台入口”收口为可验收的三端后台雏形。

本轮验收重点：

- 采购方企业端优先形成完整后台菜单、核心列表、详情与主流程操作入口。
- 供应商企业端补齐商机、订单、应收等协同页的信息摘要。
- 平台运营端补齐租户、企业审核、公告等基础运营页的信息摘要。
- 继续使用当前 React 状态切换方式，不引入 `react-router`。
- 第一轮只消费已有 mock/Java 数据映射，不新增后端接口作为页面细节优化前提。

## 当前基线

| 项目 | 当前结论 | 验收依据 |
| --- | --- | --- |
| 前端入口 | 已从三卡片入口转为后台壳 | 左侧角色菜单覆盖平台运营端、采购方企业端、供应商企业端 |
| 默认角色 | 默认进入采购方企业端 | 采购方后台作为第一阶段主验收路径 |
| 数据访问 | 仍由 `services/procurementApiClient.ts` 统一承接 | Java 与 mock 模式共存 |
| 页面切换 | 仍使用 `activeRole` / `activeModule` 状态切换 | 未引入路由库 |
| 验证命令 | `npm run build`、`npm test` | 当前作为前端第一轮回归门槛 |

## 一、采购方企业端验收

采购方企业端是阶段三第一轮的主线端，目标是支持“需求申请 -> 审批 -> 询价 -> 报价对比 -> 订单 -> 收货 -> 发票付款 -> 审计”的后台雏形。

| 菜单 | 当前验收点 | 关键组件/能力 |
| --- | --- | --- |
| 首页看板 | 采购金额、待审批需求、询价数量、履约进度、私域供应商可见 | MVP 业务主线展示 |
| 采购需求 | 列表、需求详情、预算、审批入口、新建需求表单 | `DemandDetailPanelView`、`DemandDetailOperationPanel` |
| 审批中心 | 待审批、审批详情、通过/驳回入口、审批摘要 | `ApprovalDetailOperationPanel` |
| 供应商库 | 私域供应商列表、准入状态、关系摘要、提交准入 | `SupplierDetailOperationPanel` |
| 物料目录 | 物料/服务列表、目录详情、供应商覆盖和目录摘要 | `MaterialDetailSummaryPanel` |
| 询价项目 | RFQ 列表、详情、邀请供应商、新建询价表单 | `RfqDetailOperationPanel` |
| 报价对比 | 报价对比卡片、推荐定标、定标审批入口 | `QuoteComparisonOperationPanel` |
| 采购订单 | 订单列表、订单详情、生成订单和履约摘要 | `OrderDetailOperationPanel` |
| 收货验收 | 待收货订单、验收详情、登记收货表单和验收摘要 | `ReceiptInspectionOperationPanel`、`ReceiptRegistrationForm` |
| 发票付款 | 发票列表、付款详情、登记付款表单和付款摘要 | `InvoicePaymentOperationPanel`、`PaymentRegistrationForm` |
| 审计日志 | 最近操作、审计详情、操作摘要和关联业务 | `AuditTraceabilitySummaryPanel` |

采购方端第一轮结论：后台菜单、核心列表、详情面板和主流程操作入口已经具备第一轮可验收基础。第二轮可继续补复杂新建/编辑表单、批量操作、筛选、详情抽屉和更强的 Java 联调体验。

## 二、供应商企业端验收

供应商企业端第一轮重点是把协同页面从“能看列表”提升为“能判断下一步动作”。

| 菜单 | 当前验收点 | 关键组件/能力 |
| --- | --- | --- |
| 供应商看板 | 合作采购方、询价邀请、销售订单、待回款发票可见 | 供应商基础 KPI |
| 询价邀请 | 商机响应摘要、邀请总数、待报价、已报价、最近截止、下一步 | `SupplierOpportunityResponseSummaryPanel` |
| 报价记录 | 已提交报价、金额、交付天数、税率、报价状态 | 报价列表 |
| 销售订单 | 销售订单摘要、采购方租户、订单金额、预计收货、物流单号、发票状态、下一步 | `SupplierOrderActionSummaryPanel` |
| 发票应收 | 应收摘要、应收总额、待回款、已回款、发票数量、下一步 | `SupplierInvoiceReceivableSummaryPanel` |
| 企业档案 | 供应商档案摘要、企业档案卡片、协同能力卡片、认证状态、合作采购方、资质维护、联系人与子账号 | `SupplierProfileSummaryPanel`、`SupplierProfileCapabilityCard` |

供应商端第一轮结论：商机、订单、应收、企业档案四类关键协同页已具备后台化摘要和结构化卡片。第二轮可继续补供应商企业档案编辑、资质上传、联系人/子账号、报价详情和应收对账。

## 三、平台运营端验收

平台运营端第一轮定位为“基础可查看页面”，不做复杂套餐计费和运营 BI，但需要能支撑 SaaS 平台的运营判断。

| 菜单 | 当前验收点 | 关键组件/能力 |
| --- | --- | --- |
| 平台看板 | 采购租户、公共供应商、启用套餐、待审核企业、下一步 | `PlatformOperationSummaryPanel` |
| 租户列表 | 租户运营摘要、租户总数、启用租户、待审核租户、用户容量、套餐覆盖、下一步 | `PlatformTenantListSummaryPanel` |
| 企业审核 | 企业审核摘要、审核操作、企业审核卡片、企业类型、所属行业、审核状态、下一步 | `PlatformEnterpriseReviewSummaryPanel`、`PlatformEnterpriseReviewActionPanel`、`PlatformEnterpriseReviewCard` |
| 平台公告 | 公告发布摘要、公告发布表单、公告明细卡片、发布范围、发布时间、发布状态 | `PlatformAnnouncementSummaryPanel`、`PlatformAnnouncementPublishPanel`、`PlatformAnnouncementCard` |

平台端第一轮结论：基础运营页已经从只读列表升级为带运营摘要、基础操作和结构化明细卡片的后台雏形。第二轮可继续补租户详情、公告编辑/撤回、功能开关持久化、企业审核操作持久化和套餐维护。

## 四、当前验证命令

| 命令 | 期望 |
| --- | --- |
| `npm run build` | Vite 生产构建通过 |
| `npm test` | 全量 Vitest 通过 |
| 浏览器验收 | 打开 `http://localhost:3000/`，三端菜单可切换，页面无加载失败、无 React runtime error、无横向溢出 |
| Java 模式逐页联调 | 按 `docs/stage-three-java-page-walkthrough.md` 验收三端所有菜单 |

已在本轮针对以下页面执行浏览器验收：

- 供应商企业端：询价邀请、销售订单、发票应收。
- 平台运营端：租户列表、企业审核、平台公告。
- 采购方企业端：前序已覆盖核心菜单、详情和操作摘要。

## 五、第一轮未完成项

这些事项不阻塞“后台雏形”验收，但应放入第二轮或后续迭代：

- 平台端：公告编辑/撤回、企业审核通过/驳回持久化、租户详情、套餐/功能开关持久化。
- 供应商端：企业档案编辑、资质附件上传、报价详情、销售订单详情、应收对账明细。
- 采购方端：更完整的新建/编辑表单、列表筛选、批量操作、详情抽屉、附件上传体验。
- 三端通用：真实登录页、权限差异展示、消息中心、附件中心、空态和错误态统一。
- Java 联调：已形成逐页联调结果文档，后续每轮仍应作为回归门槛保留。

## 六、进入第二轮的建议口径

可以进入第二轮的前提：

1. `npm run build` 通过。
2. `npm test` 通过。
3. `npm run java:smoke` 通过。
4. 按 `docs/stage-three-java-page-walkthrough-result.md` 复核 Java 模式逐页联调结论，三端菜单切换无加载失败、无 React runtime error、无横向溢出。
5. 用户确认第一轮页面风格、信息密度和后台形态基本可接受。

第二轮建议优先级：

1. 平台端补真实操作：企业审核、租户功能开关、公告发布。
2. 采购方端补高频表单：需求、RFQ、供应商准入、收货、付款。
3. 供应商端补协同表单：企业档案、资质、报价详情、发货、发票。
4. 保留 Java 模式逐页联调为每轮回归门槛，明确哪些页面仍来自 mock 派生数据。
5. 开始补筛选、分页、详情抽屉和权限差异。

## 七、第一轮最终验收矩阵

这张矩阵用于判断“第一轮后台雏形是否可以收口”。结论只针对当前阶段三第一轮，不代表业务功能已经完整生产可用。

| 端 | 页面 | 第一轮状态 | 仍需补强 | 第二轮处理 |
| --- | --- | --- | --- | --- |
| 采购方 | 首页看板 | 可进入第二轮 | Java 模式下指标口径需要逐页确认 | 先做 Java 模式逐页联调 |
| 采购方 | 采购需求 | 可进入第二轮 | 新建、编辑、附件上传和筛选仍偏轻 | 第二轮补高频表单和详情抽屉 |
| 采购方 | 审批中心 | 可进入第二轮 | 审批模板仍是固定模板 | 第二轮补可配置审批流 |
| 采购方 | 供应商库 | 可进入第二轮 | 准入资料、分级、黑名单编辑不完整 | 第二轮补供应商准入表单 |
| 采购方 | 物料目录 | 可进入第二轮 | 分类、批量导入和供应商授权待补 | 第二轮补目录维护能力 |
| 采购方 | 询价项目 | 可进入第二轮 | 创建 RFQ 后的详情联动仍需 Java 逐页验收 | 第二轮补 RFQ 表单和详情抽屉 |
| 采购方 | 报价对比 | 可进入第二轮 | 定标审批仍是轻量入口 | 第二轮补定标记录和审批链路 |
| 采购方 | 采购订单 | 可进入第二轮 | 订单生成已表单化，订单详情和履约状态仍需后端联调加强 | 第二轮补订单详情和状态流 |
| 采购方 | 收货验收 | 可进入第二轮 | 登记收货已表单化，验收附件、差异处理和批量收货待补 | 第二轮补验收附件和差异处理 |
| 采购方 | 发票付款 | 可进入第二轮 | 登记付款已表单化，三单匹配、对账和付款申请待补 | 第二轮补财务协同 |
| 采购方 | 审计日志 | 可进入第二轮 | 操作筛选、导出和审计详情深度待补 | 第二轮补筛选和导出 |
| 平台 | 平台看板 | 可进入第二轮 | 运营指标还不是真实 BI | 第二轮补用量和套餐运营 |
| 平台 | 租户列表 | 可进入第二轮 | 租户详情和功能开关持久化待补 | 第二轮补租户详情和开关配置 |
| 平台 | 企业审核 | 可进入第二轮 | 审核结果持久化和审核资料详情待补 | 第二轮补审核详情和持久化 |
| 平台 | 平台公告 | 可进入第二轮 | 公告编辑、撤回、范围持久化待补 | 第二轮补公告生命周期 |
| 供应商 | 供应商看板 | 可进入第二轮 | KPI 口径需 Java 模式逐页联调 | 先做 Java 模式逐页联调 |
| 供应商 | 询价邀请 | 可进入第二轮 | 报价详情和附件仍需补强 | 第二轮补报价详情 |
| 供应商 | 报价记录 | 可进入第二轮 | 报价历史对比和撤回/修改待补 | 第二轮补报价生命周期 |
| 供应商 | 销售订单 | 可进入第二轮 | 发货详情、物流轨迹和确认动作持久化待补 | 第二轮补履约表单 |
| 供应商 | 发票应收 | 可进入第二轮 | 对账明细和回款记录待补 | 第二轮补应收对账 |
| 供应商 | 企业档案 | 可进入第二轮 | 资质、联系人、子账号仍未持久化管理 | 第二轮补档案编辑和资质附件 |

第一轮最终结论：采购方主流程、平台基础运营页、供应商协同页已经具备后台雏形；Java 模式逐页联调已有通过记录。建议保留 Java 模式逐页联调作为回归门槛，再进入第二轮。

## 八、第一轮 UI 收尾验收

第一轮后半段针对“菜单有了但页面细节还粗”的问题，已补以下 UI 收尾项。它们不新增后端接口，目标是让后台雏形在真实演示和普通浏览器验收中更稳定。

| 收尾项 | 当前结论 | 验收依据 |
| --- | --- | --- |
| 移动端顶部角色/模块导航 | 小屏不再保留挤压式固定左栏，改为顶部横向角色与模块导航 | `MobileAdminNav`、`scripts/admin-shell-polish-ui.test.ts` |
| 去除生产页面占位文案 | 列表工具条和协同入口不再出现“预留”类临时文案 | `scripts/admin-list-toolbar-ui.test.ts` |
| 采购方列表详情并排延后到 2xl | 普通笔记本和中屏下先保持上下结构，避免列表和详情面板互相挤压 | `2xl:grid-cols[...]`、`scripts/admin-shell-polish-ui.test.ts` |
| 通用卡片小屏换行 | 审批、供应商、物料、审计、订单履约等卡片标题、状态、金额和操作区可自然换行 | `AdminInfoCard`、`WorkflowListCard` |
| 响应式表格摘要卡片 | 租户列表和询价项目在小屏显示摘要卡片，桌面端保留表格密度 | `ResponsiveTableFrame`、`scripts/responsive-table-frame-ui.test.ts` |
| 共享移动摘要卡片 | 租户列表、询价项目和对账单台账统一移动端标题、状态、事实网格、选中态和详情入口样式 | `ResponsiveSummaryCard`、`ResponsiveTableFrame`、`scripts/stage-three-first-round-responsive-summary-card-ui.test.ts` |
| 采购方定标和订单动作表单化 | 报价对比页定标原因、采购订单页预计收货日期不再是单按钮裸操作 | `BuyerAwardDraft`、`BuyerOrderDraft`、`scripts/buyer-award-order-action-forms-ui.test.ts` |
| 供应商准入动作表单化 | 供应商详情页补准入理由和授权品类确认，避免准入动作缺少上下文 | `BuyerSupplierAdmissionDraft`、`scripts/buyer-supplier-admission-action-form-ui.test.ts` |
| 审批处理动作表单化 | 审批中心通过/驳回前需要填写审批意见，固定审批模板下也能保留处理上下文 | `BuyerApprovalReviewDraft`、`scripts/buyer-approval-action-forms-ui.test.ts` |
| 订单收货和发票付款详情动作表单化 | 订单/收货详情可选择验收结果后登记收货，发票详情可选择付款状态后登记付款 | `ReceiptRegistrationForm`、`PaymentRegistrationForm`、`scripts/buyer-fulfillment-detail-action-forms-ui.test.ts` |
| 快捷操作草稿保护 | 订单、收货和发票列表中的快捷下拉只合并更新单个字段，不覆盖详情表单中的备注、异常原因、附件和对账草稿 | `updateReceiptDraft`、`updatePaymentDraft`、`scripts/buyer-fulfillment-action-forms-ui.test.ts` |
| 快捷操作面板统一 | 订单履约、收货验收和发票付款列表的快捷登记入口统一为紧凑操作面板，补充右侧详情可继续完善的信息提示 | `InlineWorkflowAction`、`scripts/buyer-fulfillment-list-card-ui.test.ts` |
| 列表工具条提示优化 | 列表工具条不再显示误导性的“快速筛选”，改为明确提示顶部搜索和状态筛选，并增强窄屏标签稳定性 | `ListToolbar`、`scripts/admin-list-toolbar-ui.test.ts` |
| 状态筛选组件优化 | 状态筛选补充筛选器语义、可选项数量和移动端上下布局，避免小屏下选择框挤压 | `StatusFilterControl`、`scripts/buyer-workflow-status-filters-ui.test.ts` |
| 流程状态提示语义优化 | 等待、已处理等流程提示补充可访问标签和长文本换行，减少详情区状态提示在窄屏下的割裂感 | `ProcessStateNotice`、`scripts/admin-shell-polish-ui.test.ts` |
| 共享视觉原语收口 | 面板、详情分组、流程卡片和状态标签补齐浅阴影、分隔线、详情浅底和不换行状态胶囊，让三端后台页面更接近可演示后台形态 | `Panel`、`DetailPanelBody`、`DetailSection`、`WorkflowListCard`、`StatusPill`、`scripts/stage-three-first-round-ui-polish.test.ts` |
| 共享卡片密度收口 | 通用信息卡和主流程卡片标题、元信息、金额和快捷操作区补齐长文本换行、最小宽度和窄屏抗挤压能力 | `AdminInfoCard`、`WorkflowListCard`、`InlineWorkflowAction`、`scripts/stage-three-first-round-card-density-ui.test.ts` |
| 共享详情密度收口 | 详情头、分组标题、Key/Value 行和事实网格补齐长文本换行、移动端单列和计数标签抗挤压能力 | `DetailHeroCard`、`DetailSection`、`DetailKeyValueRow`、`InlineFactGrid`、`scripts/stage-three-first-round-detail-density-ui.test.ts` |
| 共享表单密度收口 | 详情编辑面板和主操作按钮补齐响应式头部、浅底内容区、按钮文本居中和图标抗挤压能力 | `DetailActionPanel`、`PrimaryActionButton`、`scripts/stage-three-first-round-form-density-ui.test.ts` |
| 工作台页面节奏收口 | 主滚动区 scrollbar-gutter、顶部栏半透明阴影、详情体分段边界和移动摘要卡片按压反馈已补齐，降低长页面滚动时的漂浮感和层级割裂 | `AppHeader`、`DetailPanelBody`、`ResponsiveSummaryCard`、`scripts/stage-three-admin-workbench-rhythm-ui.test.ts` |
| 筛选结果表面节奏收口 | 查询条件、结果摘要、命中记录、已选详情和清空筛选形成统一查询表面，三端列表筛选区不再像散落表单控件 | `StatusFilterControl`、`FilterResultSummary`、`scripts/stage-three-filter-surface-rhythm-ui.test.ts` |
| 列表操作表面节奏收口 | 工作流卡片中的操作状态、状态与详情、快捷动作已形成明确分区，快捷操作面板补内阴影和分割线，降低状态、详情按钮和表单混在一起的粗糙感 | `WorkflowListCard`、`InlineWorkflowAction`、`scripts/stage-three-list-action-surface-ui.test.ts` |

第一轮收口结论：可以进入第二轮，但第二轮开始前应保留 Java 模式逐页联调作为回归门槛。

## 九、第一轮浏览器视觉复核记录

本轮在 mock 数据源下启动 `http://localhost:3000/`，用于复核第一轮 UI 收尾后的后台壳、三端菜单、移动端摘要卡片和桌面表格详情布局。该复核不替代 Java 模式逐页联调，只记录页面视觉与运行稳定性。

| 视口 | 抽查页面 | 当前结论 |
| --- | --- | --- |
| 390x844 | 采购方：询价项目、发票付款、对账单台账 | 无加载失败、无 argument type mismatch、无整页横向溢出；移动端摘要卡片可自然换行 |
| 390x844 | 平台：租户列表 | 无加载失败、无 argument type mismatch、无整页横向溢出；租户移动摘要卡片可见 |
| 390x844 | 供应商：发票应收 | 无加载失败、无 argument type mismatch、无整页横向溢出；供应商协同页顶部导航与主体内容稳定 |
| 1440x900 | 采购方：询价项目、发票付款 | 无加载失败、无 argument type mismatch、无整页横向溢出；桌面端保留表格和详情信息密度 |

视觉复核结论：第一轮剩余样式问题暂未发现阻塞项，可以继续把第二轮工作重点放到功能深化、持久化边界和 Java 模式回归上。

## 十、共享组件收口后的浏览器视觉复核记录

本轮在 mock 视觉模式下复用 `http://localhost:5173/`，用于复核共享长文本、操作按钮、表格滚动和空态稳定区域收口后的核心页面观感。该复核仍不替代 Java 模式逐页联调，只记录浏览器真实渲染下的视觉稳定性。

| 视口 | 抽查页面 | 当前结论 |
| --- | --- | --- |
| 1280x720 | 采购方：首页看板、采购需求、询价项目、采购订单、发票付款 | 无加载失败、无 argument type mismatch、无浏览器错误日志；documentElement.scrollWidth 等于 clientWidth，无整页横向溢出 |
| 390x844 | 采购方：首页看板、采购需求、询价项目、发票付款 | 无加载失败、无 argument type mismatch、无浏览器错误日志；documentElement.scrollWidth 等于 clientWidth，移动端短菜单和卡片布局稳定 |
| 390x844 | 供应商：供应商看板、询价邀请 | 无加载失败、无 argument type mismatch、无浏览器错误日志；documentElement.scrollWidth 等于 clientWidth，供应商移动端模块切换稳定 |

第二次视觉复核结论：共享组件收口后的采购方核心页和供应商询价入口暂未发现阻塞性样式问题。下一步可以继续补 Java 模式回归或进入更深的财务台账、平台/供应商持久化动作。

## 十一、工作台页面节奏收口记录

本轮继续处理“菜单有了但页面细节还粗”的问题，不新增业务接口，只补共享后台壳和共享表面层级：

- 主滚动区增加 `scrollbar-gutter:stable`，降低滚动条出现/消失带来的横向抖动。
- 后台主体背景从纯白/浅灰块过渡为更稳定的工作台底色，内容区改为移动端更紧凑、桌面端更舒展的内边距节奏。
- 顶部栏增加半透明白底、浅阴影和 backdrop blur，滚动长页面时工作区标题、搜索和主流程按钮更像固定操作区。
- 详情体和详情头补分段边界与浅阴影，降低详情信息堆在一起的视觉噪声。
- 移动摘要卡片增加轻微按压反馈，列表详情入口更有可点击感。

验收依据：`scripts/stage-three-admin-workbench-rhythm-ui.test.ts`。

## 十二、筛选结果表面节奏收口记录

本轮继续补三端列表的后台细节，不新增查询接口，只优化已有筛选组件和结果摘要组件：

- `StatusFilterControl` 增加 `查询条件` 标题、蓝色左边界、白底浅阴影和更明确的选择框焦点态。
- `FilterResultSummary` 增加 `结果摘要` 标题、左边界、桌面双列布局和移动端三事实网格，统一承载当前筛选、命中记录、已选详情。
- 清空筛选按钮增加边界、禁用态和 `aria-disabled`，让可执行/不可执行状态更清楚。
- 采购方、平台、供应商所有复用筛选摘要的页面同步受益，当前不改变数据筛选逻辑。

验收依据：`scripts/stage-three-filter-surface-rhythm-ui.test.ts`。

## 十三、列表操作表面节奏收口记录

本轮继续补列表卡片的操作区细节，不改变任何业务动作：

- `WorkflowListCard` 的操作区从普通浅底行升级为带边界的双列操作表面。
- 状态和详情入口合并到 `操作状态` 区块，并增加 `状态与详情` 语义标签。
- 快捷表单入口独立为 `快捷动作` 区块，避免和状态胶囊、详情按钮混在一起。
- `InlineWorkflowAction` 增加内阴影、分割线和 `快捷动作` 小标题，让收货、付款、订单等行内表单更像后台操作面板。

验收依据：`scripts/stage-three-list-action-surface-ui.test.ts`。
