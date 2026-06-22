# 阶段五执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 阶段五入口决策 | 第1轮已完成阶段五入口决策，明确阶段五优先进入合同管理 MVP，供应商绩效基础评分作为备选方向，真实支付前置设计暂不作为第一主线；本轮仍不进入商城、竞价、招标和 AI | `docs/stage-five-entry-decision.md`、`scripts/stage-five-entry-decision.test.ts` |
| 2 | 合同管理 MVP 信息架构 | 第2轮已完成合同管理 MVP 信息架构，明确采购方菜单入口、合同台账、合同详情、合同审批、履约跟踪、合同归档、合同附件、字段草案和第一轮边界；本轮不新增 Java API、不做电子签章或外部合同系统集成 | `docs/stage-five-contract-information-architecture.md`、`scripts/stage-five-contract-information-architecture.test.ts` |
| 3 | 合同管理前端列表雏形 | 第3轮已新增采购方合同管理菜单、合同台账和只读详情面板，合同数据先由采购订单、供应商、收货验收和发票付款派生；本轮暂不新增 Java API、不新增数据库表、不做电子签章或外部合同系统集成 | `scripts/stage-five-contract-ui-skeleton.test.ts` |
| 4 | 合同管理 Java 持久化骨架 | 第4轮已新增合同台账 Java 列表接口、`contracts` 租户表、MyBatis Mapper、应用服务、前端 API 客户端映射和本地联调种子；本轮仍只做合同台账读取，不做电子签章、法务红线、合同付款或外部合同系统集成 | `scripts/java-contract-scaffold.test.ts` |
| 5 | 合同管理 Java 实数接入 | 第5轮已将采购方合同管理页面接入 Java 合同台账数据，采购方后台优先展示 `/api/v1/buyer/contracts` 返回的合同编号、状态、生效日期和履约进度；Mock 或旧数据缺少合同时继续从采购订单派生 | `scripts/stage-five-contract-java-data-ui.test.ts` |
| 6 | 合同管理 Java 视觉验收 | 第6轮已补跑 Java 模式视觉验收，覆盖采购方合同管理、询价项目、采购订单、发票付款 4 个关键页面的桌面与移动截图；同时补 `V115__contract_demo_seed.sql`，确保已执行过旧 V100 的本地库也能返回 Java 合同台账实数 | `docs/stage-five-java-visual-walkthrough-result.md`、`scripts/stage-five-java-visual-check.test.ts` |
| 7 | 合同状态与归档写入 | 第7轮已新增合同状态推进和归档写入，采购方合同详情页可通过 Java 接口推进履约状态或归档合同；已归档合同禁止继续状态推进，合同新建、附件和审批流仍留待后续迭代 | `backend-java/src/test/java/com/procurement/ContractStatusActionTests.java`、`scripts/stage-five-contract-actions-ui.test.ts`、真实 Java smoke 已验证状态推进/归档/归档后禁止推进 |
| 8 | 合同与订单付款联动台账 | 第8轮已补充订单、收货、发票付款对合同归档的联动检查，合同详情页展示归档就绪状态、归档阻断原因和订单-合同-收货-发票付款联动卡片；本轮不新增 Java 接口，先基于现有订单、物流和发票数据派生 | `scripts/stage-five-contract-linkage-ui.test.ts` |
| 9 | 合同归档联动门禁 | 第9轮已将归档合同按钮绑定到收货和发票付款联动检查，未满足归档条件时禁用归档动作并展示阻断原因；本轮仍不新增 Java 接口，先防止前端误触发不完整归档 | `scripts/stage-five-contract-archive-gate-ui.test.ts` |
| 10 | 合同归档服务端门禁 | 第10轮已在 Java 合同归档接口补服务端门禁，直接调用归档接口时也会校验关联订单已收货/完成且发票已付款；未满足条件时拒绝归档，避免绕过前端形成不完整归档 | `backend-java/src/test/java/com/procurement/ContractStatusActionTests.java` |
| 11 | 合同可归档样例链路 | 第11轮已在 Java smoke 中补充可归档合同样例，完成收货、发票付款登记和付款批次归档后，为该动态订单写入合同台账并调用既有归档接口成功归档；用于证明服务端门禁同时覆盖阻断和成功路径 | `scripts/java-local-smoke.mjs`、`scripts/java-local-smoke.test.ts`、`npm run java:smoke` |
| 12 | 合同新建编辑保存接口 | 第12轮已新增合同新建和编辑保存 Java 接口，采购方可基于当前租户采购订单创建合同台账，供应商从订单派生，未归档合同可编辑编号、名称、金额、状态、生效日期和履约进度；Java smoke 已改为通过真实创建/编辑接口生成可归档合同 | `backend-java/src/test/java/com/procurement/ContractSaveActionTests.java`、`scripts/stage-five-contract-save-actions.test.ts`、`scripts/java-local-smoke.mjs` |
| 13 | 合同前端保存入口 | 第13轮已在采购方合同管理页新增合同保存面板，支持选择采购订单新建合同、编辑选中 Java 合同、已归档合同禁用编辑，并将保存动作接入 `createBuyerContract` / `updateBuyerContract` 后刷新 Java 数据 | `App.tsx`、`scripts/stage-five-contract-save-actions.test.ts` |
| 14 | 合同附件元数据入口 | 第14轮已复用附件中心 `ownerType=contract` 模型，在合同详情页新增合同附件列表、刷新附件和登记合同附件元数据入口；本轮仍只登记附件名称、storageKey 和可见范围，不上传原文件或生成下载签名 | `App.tsx`、`services/procurementApiClient.ts`、`scripts/stage-five-contract-attachment-ui.test.ts` |
| 15 | 合同审批任务创建与回写 | 第15轮已将合同审批入口接入 Java 审批任务：合同详情可提交合同审批，审批中心可处理 `contract_approval`，审批通过后合同生效、驳回后回到草案；本轮不做多级审批、审批意见持久化或合同条款法务审查 | `backend-java/src/test/java/com/procurement/ContractApprovalFlowTests.java`、`backend-java/src/test/java/com/procurement/ApprovalTaskInboxTests.java`、`scripts/stage-five-contract-approval-entry-ui.test.ts` |
| 16 | 合同附件上传凭证与下载签名 | 第16轮已新增合同附件上传凭证和下载签名入口，合同附件可生成租户隔离 `storageKey`、`uploadUrl` 和有效期，也可按已登记附件生成 `downloadUrl`；本轮仍不落地真实对象存储、文件预览或病毒扫描 | `backend-java/src/test/java/com/procurement/AttachmentMetadataLifecycleTests.java`、`App.tsx`、`scripts/stage-five-contract-attachment-signed-url-ui.test.ts`、`scripts/java-local-smoke.mjs` |
| 17 | 合同履约联动摘要细化 | 第17轮已在合同详情页补充履约阶段、责任人、风险等级、进度百分比和下一步动作，基于订单、收货、发票付款和归档状态派生履约摘要；本轮不新增 Java 接口，先强化采购方合同后台可读性 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-fulfillment-linkage-ui.test.ts` |
| 18 | 合同上下文操作入口 | 第18轮已在合同详情页补充收货验收、发票付款和合同归档的上下文操作入口，支持从合同详情直接切换到对应采购方后台模块；本轮不新增后端接口，先完善采购方后台操作流转 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-context-actions-ui.test.ts` |
| 19 | 合同目标页联动高亮 | 第19轮已让合同上下文入口跳转后在收货验收和发票付款目标页保留来源提示并高亮相关记录，采购方可从合同详情直接定位到对应订单或发票；本轮不新增后端接口 | `App.tsx`、`scripts/stage-five-contract-target-focus-ui.test.ts` |
| 20 | 合同目标页上下文操作闭环 | 第20轮已在目标页快捷收货和快捷付款表单中补充合同来源确认与目标单据锁定提示，操作员执行登记前可确认当前动作只处理该合同关联订单或发票；本轮不新增后端接口 | `App.tsx`、`scripts/stage-five-contract-target-action-loop-ui.test.ts` |
| 21 | 合同联动操作结果回看 | 第21轮已在目标页登记收货或付款后回写合同联动结果回看，合同详情页展示最近联动动作、目标单据、来源合同和操作摘要；本轮不新增后端接口，先补齐页面内跨模块操作回看 | `App.tsx`、`scripts/stage-five-contract-linked-result-review-ui.test.ts` |
| 22 | 合同履约事件持久化台账 | 第22轮已新增 Java 合同履约事件台账，支持从合同联动入口推进收货或付款后写入 `/api/v1/buyer/contracts/{contractId}/fulfillment-events`，合同详情页展示后端履约事件台账；本轮先记录事件摘要和目标单据，不做复杂履约事件状态机 | `backend-java/src/test/java/com/procurement/ContractFulfillmentEventTests.java`、`scripts/stage-five-contract-fulfillment-event-ledger-ui.test.ts`、`scripts/java-local-smoke.mjs` |
| 23 | 合同履约事件归档复核联动 | 第23轮已将合同履约事件接入归档复核证据摘要，合同详情页展示事件证据覆盖、收货事件、付款事件和最近事件证据；后端创建履约事件时同步写入 `contract_fulfillment_event.created` 审计动作，本轮不改变归档门禁判定规则 | `backend-java/src/test/java/com/procurement/ContractFulfillmentEventTests.java`、`scripts/stage-five-contract-event-archive-review-ui.test.ts` |
| 24 | 合同归档只读事件写入边界 | 第24轮补强归档后只读闭环：已归档合同禁止继续写入新的合同履约事件，合同详情页展示归档只读写入边界并禁用合同上下文联动入口；本轮仍保留事件台账查看和归档复核证据，不新增复杂履约事件状态机 | `backend-java/src/test/java/com/procurement/ContractFulfillmentEventTests.java`、`scripts/stage-five-contract-archive-readonly-event-guard-ui.test.ts` |
| 25 | 合同归档审计视图 | 第25轮在合同详情页新增归档审计聚合视图，集中展示审批追溯、附件凭证、履约事件证据和只读边界，并在 Java smoke 中输出归档审计证据信号；本轮不新增后端审计接口，先复用当前合同详情数据形成可复核页面 | `App.tsx`、`scripts/stage-five-contract-archive-audit-view-ui.test.ts`、`scripts/java-local-smoke.mjs` |
| 26 | 合同归档审计日志明细 | 第26轮开放合同目标对象审计日志查询，前端合同详情页展示合同审计日志明细、目标对象审计和最近审计动作，Java smoke 验证归档样例可查到 `contract_fulfillment_event.created` 审计记录 | `backend-java/src/test/java/com/procurement/HttpSecurityContractTests.java`、`App.tsx`、`services/procurementApiClient.ts`、`scripts/stage-five-contract-archive-audit-log-detail-ui.test.ts`、`scripts/java-local-smoke.mjs` |
| 27 | 合同履约财务汇总 | 第27轮在合同详情页新增合同履约财务汇总，从合同视角展示合同金额、收货状态、发票金额、发票差异、付款状态、付款准备和归档阻断；本轮复用现有订单/收货/发票付款数据派生，不新增真实支付或合同付款计划接口 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-fulfillment-finance-summary-ui.test.ts` |
| 28 | 合同付款计划只读视图 | 第28轮在合同详情页新增合同付款计划只读视图，聚合关联发票、付款申请、付款批次、计划付款日和只读边界；本轮仅复用现有发票付款模块数据，不新增合同付款计划接口、不登记付款、不接真实支付 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-payment-plan-readonly-ui.test.ts` |
| 29 | 合同履约事件状态机轻量化 | 第29轮在合同详情页新增合同履约事件状态机，按待收货、待付款、待归档、已完成展示事件证据和下一步动作；本轮基于已有履约事件只读派生，不新增复杂状态机接口、不自动改写合同状态 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-fulfillment-event-state-machine-ui.test.ts` |
| 30 | 合同归档复核清单可视化 | 第30轮在合同详情页新增合同归档复核清单，聚合审批追溯、附件凭证、履约事件、付款计划和审计日志并输出复核结论；本轮只做前端只读聚合，不新增归档复核接口、不替代服务端归档门禁 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-archive-review-checklist-ui.test.ts` |
| 31 | 合同归档复核缺口定位联动 | 第31轮为合同归档复核清单补充证据区块定位，支持从审批追溯、附件凭证、履约事件、付款计划和审计日志复核项定位并高亮对应页面证据；本轮仍只做前端定位辅助，不新增归档复核审批接口、不替代服务端归档门禁 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-archive-review-gap-locator-ui.test.ts` |
| 32 | 合同归档复核缺口分组筛选 | 第32轮为合同归档复核清单补充分组摘要和筛选，支持查看全部复核项、优先处理缺口和已覆盖证据，并提示下一优先复核项；本轮仍只做前端辅助视图，不新增归档复核审批接口、不改变服务端归档门禁 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-archive-review-gap-filter-ui.test.ts` |
| 33 | 合同归档复核缺口处理建议面板 | 第33轮为合同归档复核缺口补充处理建议面板，按缺口派生建议动作、负责模块和处理路径，并可从建议定位到证据区块；本轮仍只做前端辅助建议，不新增归档复核审批接口、不形成新的后端工作流 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-archive-review-action-suggestions-ui.test.ts` |
| 34 | 合同归档复核建议快捷处理联动 | 第34轮为归档复核处理建议补充目标模块快捷入口，建议项可跳转审批中心、合同管理、收货验收、发票付款或审计日志，并保留合同上下文定位；本轮复用现有前端模块切换能力，不新增后端处理流 | `data/buyerAdminUi.ts`、`App.tsx`、`scripts/stage-five-contract-archive-review-suggestion-module-link-ui.test.ts` |
| 35 | 合同归档复核目标页提示增强 | 第35轮把归档复核建议的缺口、建议动作和处理路径带入收货验收或发票付款目标页，目标页提示从普通合同联动升级为可识别的归档复核上下文；本轮不新增后端接口，不创建新的复核工作流 | `App.tsx`、`scripts/stage-five-contract-archive-review-target-context-ui.test.ts` |
| 36 | 合同归档复核处理结果回看 | 第36轮把从归档复核建议进入目标页后的收货或付款处理结果回写到合同详情，展示缺口处理结果、新增证据状态和后续复核动作；本轮仍只做页面内回看，不新增归档复核持久化工作流 | `App.tsx`、`scripts/stage-five-contract-archive-review-result-loop-ui.test.ts` |
| 37 | 合同归档复核清单新证据状态 | 第37轮把处理结果回看联动到归档复核清单，对应缺口会显示待复核新证据、处理回看摘要和后续复核提示；本轮仍不新增 Java 归档复核状态接口，也不改变服务端归档门禁 | `App.tsx`、`scripts/stage-five-contract-archive-review-new-evidence-status-ui.test.ts` |
| 38 | 合同归档复核新证据确认动作 | 第38轮为待复核新证据补充页面内确认按钮，操作员可将对应缺口标记为已复核并显示已确认覆盖和复核确认结果；本轮仍不新增 Java 归档复核状态接口，确认结果仅作为当前页面辅助状态 | `App.tsx`、`scripts/stage-five-contract-archive-review-confirm-evidence-ui.test.ts` |
| 39 | 合同归档复核进度摘要 | 第39轮在合同详情中补充归档复核进度摘要，汇总本次复核确认、待复核新证据和待处理缺口，帮助业务人员一眼判断页面内复核推进情况；本轮仍不新增 Java 归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-progress-summary-ui.test.ts` |
| 40 | 合同归档复核操作轨迹 | 第40轮为归档复核页面内处理和确认补充只读操作轨迹，展示轨迹来源入口、复核缺口、目标单据和确认状态；本轮仍不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-operation-trace-ui.test.ts` |
| 41 | 合同归档复核操作轨迹定位联动 | 第41轮为归档复核操作轨迹补充定位证据入口，轨迹行可回到对应复核缺口和证据区块，并自动切到优先处理缺口视角；本轮仍只做页面内定位辅助，不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-operation-trace-locator-ui.test.ts` |
| 42 | 合同归档复核处理历史视图 | 第42轮为归档复核补充页面内处理历史视图，串联目标页处理、轨迹定位和复核确认结果，便于业务人员回看复核闭环所处阶段；本轮仍不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-history-ui.test.ts` |
| 43 | 合同归档复核历史风险摘要 | 第43轮为归档复核处理历史补充风险/阻断摘要，根据新证据确认状态、待复核新证据和剩余缺口输出阻断等级、阻断原因和风险下一步；本轮仍只做页面内辅助判断，不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-history-risk-summary-ui.test.ts` |
| 44 | 合同归档复核风险解除入口 | 第44轮将历史风险摘要联动到解除阻断动作入口，可从风险摘要直接定位阻断缺口或进入对应处理模块；本轮复用既有缺口处理建议和前端模块跳转，不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-risk-resolution-entry-ui.test.ts` |
| 45 | 合同归档复核关闭前检查条 | 第45轮补充归档复核关闭前检查条，汇总页面确认状态、风险解除入口、服务端归档门禁和关闭前判断，帮助业务人员在最终归档前统一复核；本轮仍不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-closeout-check-ui.test.ts` |
| 46 | 合同归档前确认动作提示 | 第46轮将关闭前检查结果映射为归档前确认动作提示，展示归档按钮判断、阻断处理路径和归档动作提示；本轮仍只做前端辅助提示，不新增 Java 审计或归档复核状态接口 | `App.tsx`、`scripts/stage-five-contract-archive-review-pre-archive-action-hint-ui.test.ts` |
| 47 | 阶段五合同管理 MVP 收口验收包 | 第47轮补充阶段五合同管理 MVP 收口验收包，按 Java 真实能力、前端辅助提示、尚未完成边界、验收证据和阶段六建议入口拆清当前可验收程度；本轮不新增业务功能，作为阶段六继续开发的决策基线 | `docs/stage-five-closeout-acceptance-package.md`、`scripts/stage-five-closeout-acceptance-package.test.ts` |

## 待补强

- 合同管理 MVP：已完成信息架构、前端菜单入口、合同台账页面、只读合同详情面板、Java 合同台账读取骨架、前端 Java 实数接入、Java 模式视觉验收、合同状态推进和归档写入、合同与订单/收货/付款联动检查、前端归档动作门禁、Java 服务端归档门禁、合同可归档正向 smoke 样例、合同新建/编辑保存接口、合同前端保存入口、合同附件元数据入口、合同审批任务创建/审批中心回写、合同附件上传凭证和下载签名、合同履约联动摘要、合同上下文操作入口、合同目标页联动高亮、合同目标页上下文操作闭环、合同联动操作结果回看、合同履约事件持久化台账、合同履约事件归档复核联动、合同归档只读事件写入边界、合同归档审计视图、合同归档审计日志明细、合同履约财务汇总、合同付款计划只读视图、合同履约事件状态机轻量化、合同归档复核清单可视化、合同归档复核缺口定位联动、合同归档复核缺口分组筛选、合同归档复核缺口处理建议面板、合同归档复核建议快捷处理联动、合同归档复核目标页提示增强、合同归档复核处理结果回看、合同归档复核清单新证据状态、合同归档复核新证据确认动作、合同归档复核进度摘要、合同归档复核操作轨迹、合同归档复核操作轨迹定位联动、合同归档复核处理历史视图、合同归档复核历史风险摘要、合同归档复核风险解除入口、合同归档复核关闭前检查条和合同归档前确认动作提示；尚未落地真实对象存储、文件预览、病毒扫描、多级审批、合同条款法务审查、后端复杂履约事件状态机、独立合同付款计划接口和归档复核审批接口。
- 阶段六建议优先补真实写入能力和统一详情表单体系：当前合同管理 MVP 已有阶段五收口验收包，后续应减少继续叠加前端只读提示，优先补 Java 真实写入、审批历史、附件真实化和归档复核后端化。
- 供应商绩效基础评分：尚未沉淀评分指标、计算依据、评分展示和评分影响边界。
- 真实支付前置设计：仅保留后续设计入口，尚未进入付款凭证、幂等号、回单和银行接口模型。

## 暂不做

- 不接真实支付、银企直连、批量付款执行、税控开票或银行回单。
- 不进入商城、竞价、招标和 AI。
- 不同时启动合同管理、供应商绩效和真实支付前置设计。
