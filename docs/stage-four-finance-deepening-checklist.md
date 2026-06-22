# 阶段四财务协同深化执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 三单匹配摘要 | 采购方发票付款详情已展示订单金额、收货状态、发票金额、差异金额、匹配结论和付款边界 | `scripts/buyer-three-way-match-ui.test.ts` |
| 2 | 对账台账匹配结论 | 应付/应收对账单台账已增加三单匹配通过数、匹配结论列和移动卡片字段 | `scripts/buyer-three-way-match-ui.test.ts`、`scripts/invoice-reconciliation-ledger-ui.test.ts` |
| 3 | 付款边界提示 | 页面会将待收货、三单未同步和金额差异转成付款前核对提示，避免误表达为已具备真实支付能力 | `scripts/buyer-three-way-match-ui.test.ts` |
| 4 | 差异处理台账 | 第二轮已在采购方发票详情中补差异金额、责任人、处理结果和处理边界，先以只读派生台账承接三单匹配异常 | `scripts/buyer-finance-action-ledger-ui.test.ts` |
| 5 | 付款申请台账 | 第二轮已在采购方发票详情和对账台账中补申请状态、付款批次、申请金额、付款申请队列和可付款批次提示 | `scripts/buyer-finance-action-ledger-ui.test.ts` |
| 6 | 付款申请 Java API | 第三轮已新增 `payment_requests` 表、采购方付款申请列表/创建端点和前端 Java client 方法，先按发票维度落库 | `scripts/java-finance-action-ledger-scaffold.test.ts` |
| 7 | 差异处理 Java API | 第三轮已新增 `variance_handlings` 表、采购方差异处理列表/创建端点和前端 Java client 方法，先按发票维度落库 | `scripts/java-finance-action-ledger-scaffold.test.ts` |
| 8 | 前端接入付款申请 Java API | 第四轮已将付款申请列表加载进采购方主数据，发票详情可展示真实 Java 记录并触发创建/更新后刷新回显 | `scripts/buyer-finance-action-java-integration-ui.test.ts` |
| 9 | 前端接入差异处理 Java API | 第四轮已将差异处理列表加载进采购方主数据，发票详情可展示真实 Java 记录并触发创建/更新后刷新回显 | `scripts/buyer-finance-action-java-integration-ui.test.ts` |
| 10 | 付款申请状态流转 | 第五轮已新增付款申请状态更新端点和前端状态按钮，支持提交付款审批、通过付款申请并刷新回显 | `scripts/finance-action-status-flow-ui.test.ts` |
| 11 | 差异处理状态流转 | 第五轮已新增差异处理状态更新端点和前端状态按钮，支持标记差异已处理、退回复核并刷新回显 | `scripts/finance-action-status-flow-ui.test.ts` |
| 12 | 付款申请审批任务化 | 第六轮已将付款申请提交审批接入现有审批任务模型，审批中心可按 `payment_request` 展示付款申请摘要 | `scripts/finance-approval-audit-flow.test.ts` |
| 13 | 差异处理审计留痕 | 第六轮已在付款申请提交/通过和差异处理状态更新时写入发票维度审计事件，便于后续履约和财务追踪 | `scripts/finance-approval-audit-flow.test.ts` |
| 14 | 付款批次台账 | 第七轮已基于 Java 付款申请记录的 `paymentBatchNo` 在采购方应付对账台账中派生付款批次台账、批次金额、批次状态和计划付款日；当时尚未落库为独立付款批次表，后续第八轮已补 Java 批次表 | `scripts/payment-batch-plan-ui.test.ts` |
| 15 | 付款计划深化 | 第七轮已在采购方发票详情中补付款计划成熟度、批次归属、计划付款日和批次计划边界，继续保持真实支付暂不接入 | `scripts/payment-batch-plan-ui.test.ts` |
| 16 | 付款批次 Java API | 第八轮已新增 `payment_batches` 表和 `GET /api/v1/buyer/payment-batches`，付款申请创建/状态更新时同步批次金额、已审批金额、申请数量、批次状态和计划付款日 | `scripts/java-payment-batch-scaffold.test.ts` |
| 17 | 付款批次 smoke | 第九轮已将付款申请创建、付款申请审批中/已通过状态流转和 `GET /api/v1/buyer/payment-batches` 批次状态回查纳入 `npm run java:smoke` | `scripts/java-payment-batch-smoke.test.ts` |
| 18 | Java 本地启动脚本 | 第十轮已新增 `npm run java:dev`，固定带上 `db/migration` 和 `db/dev` Flyway locations，避免本地库已有 V100 dev seed 记录时启动方式不一致 | `scripts/java-local-dev-start.test.ts` |
| 19 | 三单匹配后端留痕 | 第十一轮已新增 `three_way_matches` 表和 `GET /api/v1/buyer/three-way-matches`，发票创建和付款状态变化时同步订单金额、收货状态、发票金额、差异金额、匹配结论和付款准备状态 | `scripts/java-three-way-match-scaffold.test.ts` |
| 20 | 三单匹配 smoke | 第十一轮已将开票后 `可申请付款` 和付款后 `已付款归档` 的三单匹配台账回查纳入 `npm run java:smoke` | `scripts/java-three-way-match-smoke.test.ts` |
| 21 | 三单匹配历史回填 | 第十二轮已新增 `POST /api/v1/buyer/three-way-matches/rebuild`，采购方可按当前租户重建历史发票三单匹配快照，并将回填数量纳入 Java smoke | `scripts/java-three-way-match-rebuild.test.ts` |
| 22 | 三单异常联动差异处理 | 第十三轮已新增 `POST /api/v1/buyer/three-way-matches/{matchId}/variance-handling`，采购方可从 `金额差异` 的三单匹配记录生成或复用差异处理台账，非金额差异记录会被阻断 | `scripts/java-three-way-match-variance-link.test.ts` |
| 23 | 差异未处理阻断付款申请 | 第十四轮已在 Java 服务层阻断未处理金额差异发票创建付款申请，并在采购方发票详情中显示付款阻断原因、禁用创建付款申请入口 | `FinanceActionPaymentBlockingTests`、`scripts/payment-request-variance-blocking-ui.test.ts` |
| 24 | 差异处理后恢复付款申请 | 第十五轮已补充金额差异 `已处理` 后允许创建付款申请的 Java 单测，并在采购方发票详情中明确显示付款申请已恢复 | `FinanceActionPaymentBlockingTests`、`scripts/payment-request-variance-blocking-ui.test.ts` |
| 25 | 对账台账付款队列状态 | 第十六轮已将差异处理记录传入采购方应付对账台账，列表汇总可显示付款阻断数、已恢复申请数、可发起付款申请数，移动卡片和表格也展示付款申请状态 | `scripts/payment-request-ledger-queue-ui.test.ts` |
| 26 | 三单差异阻断恢复 smoke | 第十七轮已在 `npm run java:smoke` 中加入本地异常样本：扰动 smoke 发票金额、重建三单匹配、验证付款申请被阻断、生成差异处理、标记已处理并恢复付款申请 | `scripts/java-three-way-match-variance-smoke.test.ts` |
| 27 | 付款批次执行准备摘要 | 第十八轮已在采购方应付台账中增加批次审批队列、可执行金额、待提交批次、已归档批次和行级执行准备提示，帮助区分审批中、可安排付款和已归档批次 | `scripts/payment-batch-execution-readiness-ui.test.ts` |
| 28 | 付款批次审批入口 | 第十九轮已新增批次级状态更新 API 和采购方应付台账按钮，支持提交批次审批、通过批次审批、标记付款归档，先做批次状态流转，不接真实支付执行 | `scripts/java-payment-batch-status-flow.test.ts`、`scripts/payment-batch-approval-action-ui.test.ts` |
| 29 | 付款批次审批任务化 | 第二十轮已新增 `payment_batch` 审批业务类型、`TPL_PAYMENT_BATCH` 模板、审批中心批次摘要，并在批次提交审批/通过审批时创建和关闭审批任务；Java smoke 已补批次审批待办出现和关闭校验 | `scripts/finance-approval-audit-flow.test.ts`、`scripts/java-payment-batch-smoke.test.ts`、`ApprovalTaskInboxTests` |
| 30 | 付款计划风险摘要 | 第二十一轮已在采购方应付台账补充付款批次逾期数、7 天内到期数、最早处理日、计划风险摘要和行级计划风险提示，继续保持真实支付执行不接入 | `scripts/payment-batch-schedule-risk-ui.test.ts` |
| 31 | 付款批次风险筛选 | 第二十二轮已在采购方应付台账增加批次风险筛选和风险优先排序，支持快速查看全部批次、逾期优先、7 天内到期、可执行批次和审批中批次 | `scripts/payment-batch-risk-filter-ui.test.ts` |
| 32 | 付款批次详情侧栏 | 第二十三轮已在采购方应付台账增加批次选择和详情侧栏，按批次展示付款申请、批次内发票、三单匹配状态、差异处理状态和付款执行边界 | `scripts/payment-batch-detail-panel-ui.test.ts` |
| 33 | 批次详情内联操作 | 第二十四轮已在付款批次详情侧栏补充付款申请提交/通过和差异处理已处理/退回复核按钮，减少财务人员在发票行和批次详情之间来回跳转 | `scripts/payment-batch-detail-actions-ui.test.ts` |
| 34 | 付款批次执行记录 | 第二十五轮已在付款批次详情侧栏增加模拟执行轨迹、付款登记状态和真实支付边界，明确当前只记录计划执行和付款登记轨迹，不接真实支付 | `scripts/payment-batch-execution-record-ui.test.ts` |
| 35 | 付款批次执行记录 Java API | 第35轮已新增 `payment_execution_records` 表和 `GET /api/v1/buyer/payment-execution-records`，按当前租户从付款申请和发票状态刷新只读执行记录，支持按付款批次、执行状态、供应商和发票筛选；仍只记录计划执行和付款登记轨迹，不接真实支付 | `scripts/java-payment-execution-record-scaffold.test.ts` |
| 36 | 付款执行记录前端接入 Java 台账 | 第36轮已将采购方付款批次详情侧栏优先切到 Java `paymentExecutionRecords` 台账展示，缺少后端记录时才回退到前端派生轨迹，并在执行记录卡片中标明数据来源 | `scripts/payment-batch-execution-record-java-ui.test.ts` |
| 37 | 付款批次执行汇总指标 | 第37轮已在付款批次详情侧栏增加已登记金额、待登记金额、暂不可登记金额、待登记笔数、暂不可登记笔数和执行判断，帮助财务人员按批次判断下一步登记动作 | `scripts/payment-batch-execution-summary-ui.test.ts` |
| 38 | 付款批次执行汇总 Java API | 第38轮已将付款批次执行汇总口径下沉到 Java `GET /api/v1/buyer/payment-batches` 响应，返回已登记/待登记/暂不可登记金额、笔数和执行判断；前端批次详情优先展示后端汇总，缺失时再用本地执行记录兜底 | `scripts/java-payment-batch-execution-summary.test.ts` |
| 39 | 付款执行阻断原因 Java API | 第39轮已在 Java 付款执行记录中新增 `executionBlockReason`，按付款申请、三单匹配和差异处理状态返回付款申请未通过、三单未同步、差异未处理、三单未通过等阻断原因，并在批次执行记录卡片展示 | `scripts/java-payment-execution-block-reason.test.ts` |
| 40 | 付款批次阻断概览 Java API | 第40轮已在 Java 付款批次响应中新增 `executionBlockSummary`，聚合批次内暂不可登记和付款审批中的执行阻断原因，并在付款批次详情摘要展示阻断概览 | `scripts/java-payment-batch-block-summary.test.ts` |
| 41 | 付款批次阻断队列筛选 | 第41轮已在采购方应付台账增加阻断原因筛选、阻断队列统计和付款阻断队列明细，可按差异未处理、三单未同步、付款审批中等原因筛出批次并定位到批次详情 | `scripts/payment-batch-block-queue-ui.test.ts` |
| 42 | 付款阻断处理建议 | 第42轮已在付款阻断队列中按阻断原因展示处理建议和处理入口，帮助财务人员从差异未处理、三单未同步、三单未通过、付款审批中等原因定位到下一步动作 | `scripts/payment-batch-block-action-hints-ui.test.ts` |
| 43 | 付款阻断原因分布 | 第43轮已在付款阻断队列上方增加阻断原因分布，按原因汇总阻断笔数、阻断金额和涉及批次数，并支持点击原因快速切换筛选 | `scripts/payment-batch-block-reason-distribution-ui.test.ts` |
| 44 | 付款批次当前原因明细 | 第44轮已在付款批次详情中按当前阻断原因筛选展示执行明细、当前原因笔数和当前原因金额，便于从全局分布定位到单批次内具体发票和付款申请 | `scripts/payment-batch-detail-block-reason-ui.test.ts` |
| 45 | 付款阻断处理闭环指引 | 第45轮已在付款批次当前原因明细中补当前处理状态、处理路径、处理入口和处理闭环边界，先做原因级处理指引，不自动改写付款、三单或差异状态 | `scripts/payment-batch-block-resolution-ui.test.ts` |
| 46 | 付款阻断处理队列状态 | 第46轮已在当前原因明细中按付款登记状态和执行轨迹派生待处理、处理中、已处理待刷新、仍阻断四类队列状态，并展示队列状态分布和刷新提示 | `scripts/payment-batch-resolution-queue-ui.test.ts` |
| 47 | 付款阻断处理状态筛选 | 第47轮已在当前原因明细中增加处理状态筛选，支持按全部处理状态、待处理、处理中、已处理待刷新、仍阻断查看筛选后处理队列和空态反馈 | `scripts/payment-batch-resolution-stage-filter-ui.test.ts` |
| 48 | 付款阻断处理动作入口 | 第48轮已在处理队列卡片中按处理阶段展示下一步动作、定位入口、操作边界和入口按钮，帮助财务人员从待处理、处理中、已处理待刷新、仍阻断继续推进 | `scripts/payment-batch-resolution-action-entry-ui.test.ts` |
| 49 | 付款阻断动作上下文联动 | 第49轮已在处理动作入口卡片中补目标分区、目标单号、关联发票和联动说明，帮助财务人员从动作入口定位到批次内付款申请、发票、执行记录或执行边界 | `scripts/payment-batch-resolution-context-link-ui.test.ts` |
| 50 | 阶段四财务深化小验收 | 第50轮已新增阶段四财务深化小验收文档，按第35轮到第49轮梳理付款批次阻断处理链路、已完成能力、只读与入口边界、验收证据和下一阶段建议 | `docs/stage-four-finance-closeout-review.md`、`scripts/stage-four-finance-closeout-review.test.ts` |
| 51 | 付款阻断处理状态 Java 台账 | 第51轮已新增 `payment_block_resolutions` 后端台账、查询/创建/更新状态端点和前端 API client 契约，开始把前端派生的阻断处理状态沉淀为可持久化记录 | `scripts/java-payment-block-resolution-scaffold.test.ts` |
| 52 | 付款阻断处理状态前端接入 | 第52轮已将 Java `paymentBlockResolutions` 台账接入采购方应付对账台账，当前原因处理队列优先展示后端持久化处理状态、处理动作、下一步和处理来源，缺失时再回退前端派生状态 | `scripts/payment-block-resolution-java-ui.test.ts` |
| 53 | 付款阻断处理状态页面写入 | 第53轮已在付款阻断处理队列卡片中增加保存处理状态、标记处理中、标记已处理待刷新按钮，调用 Java `payment-block-resolutions` 创建/更新端点并刷新采购方数据 | `scripts/payment-block-resolution-write-ui.test.ts` |
| 54 | 付款阻断处理审计信息展示 | 第54轮已确认付款阻断处理状态保存/更新会写入 Java 审计动作，并在付款阻断处理队列卡片中展示最近处理人和处理时间 | `scripts/payment-block-resolution-audit-ui.test.ts` |
| 55 | 付款阻断处理记录台账 | 第55轮已在付款批次详情中增加付款阻断处理记录小台账，按当前批次汇总 Java `paymentBlockResolutions` 的处理状态、处理人、更新时间、阻断原因、处理动作和下一步 | `scripts/payment-block-resolution-ledger-ui.test.ts` |
| 56 | Java 模式付款批次视觉验收 | 第56轮已修复本地 Java 模式 CORS，支持 `3001` 验收端口和 Java `PUT` 状态动作；Chrome CLI 已产出桌面与移动截图，并通过 DOM 检查确认发票付款、付款批次详情和处理记录台账无加载失败 | `docs/stage-four-java-visual-walkthrough-result.md`、`scripts/stage-four-java-visual-check.test.ts` |
| 58 | 付款阻断处理记录非空回显 | 第58轮已在 Java local smoke 中创建、更新和查询 `Java smoke 阻断处理记录`，并在 Java 视觉验收脚本中自动创建或更新 `Java visual smoke 阻断处理记录`，通过 DOM 检查确认付款批次详情的处理记录台账非空回显 | `scripts/java-payment-block-resolution-smoke.test.ts`、`scripts/stage-four-java-visual-check.test.ts` |
| 59 | 阻断处理执行复核提示 | 第59轮已在付款批次详情的执行汇总区增加执行复核提示，按当前批次 Java `paymentBlockResolutions` 汇总 `已处理待刷新` 和 `处理中` 记录，提示财务复核三单、差异、付款申请后再登记付款，同时明确处理记录只影响复核提示，不自动改写付款、三单或差异状态 | `scripts/payment-block-resolution-execution-review-ui.test.ts` |
| 60 | 阻断处理复核动作清单 | 第60轮已在付款批次详情增加复核动作清单，按三单匹配刷新、差异处理复核和付款申请复核拆出状态、入口和边界，帮助财务从已处理待刷新记录继续定位到批次内发票、付款申请和三单刷新动作；本轮仍不自动改写付款、三单或差异状态 | `scripts/payment-block-resolution-review-actions-ui.test.ts` |
| 61 | 三单匹配刷新真实动作 | 第61轮已将复核动作清单中的三单匹配刷新升级为真实按钮，采购方 Java 模式下可调用 Java `rebuildBuyerThreeWayMatches()` 重建当前租户三单匹配快照，刷新买方数据后回到付款批次详情继续复核执行记录；仍不接真实支付和自动付款登记 | `scripts/payment-block-resolution-three-way-rebuild-ui.test.ts` |
| 62 | 差异处理复核定位 | 第62轮已在复核动作清单的差异处理复核项中展示待处理差异数量，并在存在待处理差异时提供定位待处理差异按钮，一键选中首个待处理差异发票并回到发票详情继续处理；仍不自动关闭差异或登记付款 | `scripts/payment-block-resolution-variance-review-ui.test.ts` |
| 63 | 付款申请复核定位 | 第63轮已在复核动作清单的付款申请复核项中展示待复核付款申请数量，并在存在未通过付款申请时提供定位付款申请按钮，一键选中首个待复核付款申请关联发票；仍不自动通过审批或登记真实支付 | `scripts/payment-block-resolution-payment-request-review-ui.test.ts` |
| 64 | 付款申请复核定位反馈 | 第64轮已在定位付款申请后高亮批次内首个待复核付款申请卡片，并展示当前定位与待复核付款申请定位提示，帮助财务人员明确下一条要提交或通过的付款申请；仍不自动通过审批或登记真实支付 | `scripts/payment-block-resolution-payment-request-focus-ui.test.ts` |
| 65 | 付款申请复核定位推进 | 第65轮已在当前定位的付款申请通过后自动推进到下一条待复核付款申请；若批次内已无待复核申请则清空当前定位，并在定位提示中说明定位已推进；仍不自动登记真实支付 | `scripts/payment-block-resolution-payment-request-focus-advance-ui.test.ts` |
| 66 | 付款申请完成后执行记录刷新提示 | 第66轮已在付款批次执行摘要区增加执行记录刷新提示：付款申请均已通过时提示刷新三单匹配和执行记录后再进入付款登记，仍有待复核申请时提示先完成付款申请复核；真实支付仍不接入 | `scripts/payment-batch-execution-refresh-hint-ui.test.ts` |
| 67 | 付款执行复核刷新入口 | 第67轮已将执行记录刷新提示升级为受控操作入口：付款申请均已通过时可点击刷新执行复核，仍有待复核付款申请时提示先完成付款申请复核；按钮复用 Java 三单匹配重建动作刷新后回看执行记录，真实支付仍不接入 | `scripts/payment-batch-execution-refresh-action-ui.test.ts` |
| 68 | 付款执行登记前置条件显性化 | 第68轮已在付款批次执行记录卡片中增加登记前置条件、登记放行判断和下一处理动作：已登记记录提示归档审计，待登记记录提示可进入付款登记，仍阻断记录提示按阻断原因处理后刷新执行复核；真实支付仍不接入 | `scripts/payment-batch-execution-registration-gate-ui.test.ts` |
| 69 | 付款执行记录登记入口 | 第69轮已在付款批次执行记录卡片中增加登记付款状态入口：仅当登记放行判断为可进入付款登记时复用采购方 Java 付款登记动作，仍阻断和已登记记录保持禁用边界；该入口只登记付款状态，不接真实支付、银企直连或批量付款 | `scripts/payment-batch-execution-registration-action-ui.test.ts` |
| 70 | 付款登记后复核提示 | 第70轮已在付款批次执行记录卡片中增加登记后复核提示：待登记记录提示登记后刷新执行记录并回看已登记金额和待登记金额，已登记记录提示进入归档审计，仍阻断记录继续提示先处理阻断原因；真实支付仍不接入 | `scripts/payment-batch-execution-registration-post-action-ui.test.ts` |
| 71 | 付款登记后批次复核摘要 | 第71轮已在付款批次执行汇总区增加登记后复核摘要和登记后下一步，按暂不可登记、待登记、已登记三类状态提示先处理暂不可登记阻断、继续登记待登记付款或刷新执行记录后归档审计；真实支付仍不接入 | `scripts/payment-batch-registration-review-summary-ui.test.ts` |
| 72 | 付款执行状态机只读契约 | 第72轮已在 Java 付款执行记录响应中派生 `executionStage` 和 `executionNextAction`，前端 Java client 和付款批次执行记录卡片优先展示后端状态机阶段与下一处理动作；本轮只做只读契约和页面展示，不新增表、不接真实支付 | `scripts/payment-execution-state-machine-contract.test.ts` |
| 73 | 付款执行登记状态流转入口 | 第73轮已新增专用执行记录登记入口：Java `POST /api/v1/buyer/payment-execution-records/{executionRecordId}/registration` 只允许 `待登记付款` 的执行记录登记，前端付款批次执行记录按钮改为调用专用执行记录登记入口；真实支付仍不接入 | `scripts/payment-execution-registration-transition.test.ts` |
| 74 | 付款批次归档门禁 | 第74轮已在 Java 批次归档动作前刷新付款执行记录并校验批次执行汇总，只有全部执行记录已登记后才允许归档；前端付款批次列表同步展示归档门禁并禁用未满足条件的归档按钮，真实支付仍不接入 | `scripts/payment-batch-archive-gate.test.ts` |
| 75 | 付款批次归档审计摘要 | 第75轮已在付款批次归档审计 action 中沉淀登记笔数、登记金额和归档前执行判断，并在采购方付款批次详情展示归档人、归档时间和归档前执行摘要；真实支付仍不接入 | `scripts/payment-batch-archive-audit-summary.test.ts` |
| 76 | 付款批次归档后只读冻结 | 第76轮已将已归档付款批次收口为只读审计状态：Java service 阻止付款申请、差异处理、执行登记和阻断处理写入继续改写归档批次；前端批次详情展示归档冻结边界并禁用相关动作入口，后续只允许查看审计追踪 | `scripts/payment-batch-archive-freeze.test.ts` |
| 77 | 付款批次归档冻结反馈 | 第77轮已把归档冻结拒绝提示从 Java 异常文本映射为采购方可理解的中文工作流反馈，并将“拒绝、冻结、不允许”统一识别为错误态提示，避免归档后正常拒绝被误读为系统成功或未知失败 | `scripts/payment-batch-archive-freeze-feedback.test.ts` |
| 78 | 付款批次归档审计面板 | 第78轮已在付款批次详情中增加归档审计面板，将归档动作、冻结反馈、付款登记摘要和处理记录入口集中展示，并继续明确只读审计和真实支付不接入边界 | `scripts/payment-batch-archive-audit-panel-ui.test.ts` |
| 79 | Java 模式归档审计面板视觉验收 | 第79轮已扩展 Java 模式付款批次视觉脚本，桌面和移动截图对应 DOM 需检查归档审计面板、审计追踪入口、处理记录台账和失败信号，确保第78轮新增面板在真实 Java 数据源下可见 | `scripts/stage-four-java-visual-check.test.ts`、`scripts/stage-four-java-visual-check.mjs` |
| 80 | 付款归档收口复盘 | 第80轮已完成第73到第79轮付款执行归档能力的阶段性复盘，按专用付款执行登记入口、归档门禁、归档审计摘要、归档后只读冻结、冻结反馈、归档审计面板和 Java 视觉验收梳理已完成能力、只读审计边界、验收证据和下一步建议 | `docs/stage-four-payment-archive-closeout-review.md`、`scripts/stage-four-payment-archive-closeout-review.test.ts` |
| 81 | 阶段四财务域总体验收矩阵 | 第81轮已把三单匹配、差异处理、付款申请、付款批次、执行记录、阻断处理和归档冻结统一整理为产品级验收矩阵，明确阶段四可封版范围、必须保留边界、验收命令和下阶段入口 | `docs/stage-four-finance-acceptance-matrix.md`、`scripts/stage-four-finance-acceptance-matrix.test.ts` |
| 82 | 付款归档异常申请入口 | 第82轮已新增付款归档异常申请的前端契约和归档审计面板入口，先支持撤销申请、异常解冻的只读申请入口与 API 草案，明确归档异常只进入审批台账，不直接解冻或改写已归档批次 | `scripts/payment-batch-archive-exception-entry-ui.test.ts` |
| 83 | 付款归档异常申请 Java 台账 | 第83轮已新增付款归档异常申请 Java 台账，包含 `payment_archive_exception_requests` 表、领域对象、Mapper、GET/POST 端点、前端 create/list 契约、服务层已归档批次校验和 `payment_archive_exception.requested` 审计留痕；本轮仍不直接解冻或改写已归档批次 | `scripts/java-payment-archive-exception-scaffold.test.ts`、`FinanceActionPaymentBlockingTests` |
| 84 | 付款归档异常申请前端提交联动 | 第84轮已将归档异常申请入口接入 Java POST 台账，采购方已归档付款批次详情可提交撤销申请或异常解冻申请，提交后刷新 Java 数据并在归档异常申请台账回显申请人、申请时间、异常原因和审批状态；本轮仍不直接解冻或改写已归档批次 | `scripts/payment-batch-archive-exception-entry-ui.test.ts` |
| 85 | 付款归档异常申请审批任务化 | 第85轮已将付款归档异常申请接入审批中心，新增 `payment_archive_exception` 审批业务类型、`TPL_PAYMENT_ARCHIVE_EXCEPTION` 默认模板、归档异常审批摘要和创建申请后的待审批任务生成；本轮仍只完成申请审批任务化，不直接解冻或改写已归档批次 | `scripts/java-payment-archive-exception-scaffold.test.ts`、`ApprovalTaskInboxTests`、`FinanceActionPaymentBlockingTests` |
| 86 | 付款归档异常审批结果回写 | 第86轮已将付款归档异常审批结果回写到申请台账，新增归档异常申请审批端点、前端审批中心分发和 `approval_status/reviewed_by` 更新；审批通过或驳回只改变申请台账与审批任务状态，不直接解冻或改写已归档付款批次 | `scripts/java-payment-archive-exception-scaffold.test.ts`、`scripts/payment-batch-archive-exception-entry-ui.test.ts`、`FinanceActionPaymentBlockingTests` |
| 87 | 付款归档异常受控处理入口 | 第87轮已新增付款归档异常受控处理入口，审批通过的归档异常申请可登记受控处理动作，回写 `action_status/action_result/handled_by` 并写入 `payment_archive_exception.action_completed` 审计；本轮仍不直接解冻或改写已归档付款批次 | `scripts/java-payment-archive-exception-scaffold.test.ts`、`scripts/payment-batch-archive-exception-entry-ui.test.ts`、`FinanceActionPaymentBlockingTests` |
| 88 | 付款归档异常关闭复核 | 第88轮已新增付款归档异常关闭复核，受控处理已登记的归档异常申请可回写 `closure_status/closure_result/closed_by` 并写入 `payment_archive_exception.closed` 审计；本轮仍只关闭申请台账，不直接解冻或改写已归档付款批次 | `scripts/java-payment-archive-exception-scaffold.test.ts`、`scripts/payment-batch-archive-exception-entry-ui.test.ts`、`FinanceActionPaymentBlockingTests` |
| 89 | 付款归档异常 Java smoke 闭环 | 第89轮已将付款归档异常申请闭环纳入 Java smoke：已归档付款批次会提交归档异常申请、审批通过、登记受控处理、关闭复核并回查台账状态；本轮仍只验申请台账闭环，不直接解冻或改写已归档付款批次 | `scripts/java-local-smoke.test.ts`、`scripts/java-payment-archive-exception-scaffold.test.ts`、`npm run java:smoke` |
| 90 | 付款归档异常收口复盘 | 第90轮已完成付款归档异常申请链路收口复盘，按第82轮到第89轮梳理入口、Java 台账、审批任务、审批回写、受控处理、关闭复核、Java smoke 闭环和边界；本轮仍只验申请台账闭环，不直接解冻或改写已归档付款批次 | `docs/stage-four-payment-archive-exception-closeout-review.md`、`scripts/stage-four-payment-archive-exception-closeout-review.test.ts` |
| 91 | 阶段四财务最终收口包 | 第91轮已把付款前控制、付款批次、执行登记、归档冻结和归档异常统一整理为最终验收包，补齐演示路径、封版范围、必须保留边界、验收命令和下一阶段入口；本轮不新增 Java 行为 | `docs/stage-four-finance-final-closeout-package.md`、`scripts/stage-four-finance-final-closeout-package.test.ts` |

## 待补强

- 付款申请审批：当前第六轮已接入单级审批任务和默认审批人模板，付款批次审批任务化已在第二十轮补齐；尚未接入多级审批、会签和可视化审批流。
- 付款批次：第71轮已补批次级审批任务化、付款计划风险摘要、风险筛选、批次详情侧栏、详情内联操作、付款执行记录 Java 只读台账、前端台账展示接入、批次执行汇总指标、Java 批次响应汇总口径、付款执行阻断原因、批次阻断概览、阻断队列筛选、阻断处理建议、阻断原因分布、当前原因明细、处理闭环指引、处理队列状态、处理状态筛选、处理动作入口、动作上下文联动、阶段四财务深化小验收、付款阻断处理状态 Java 台账、前端展示接入、页面写入、审计信息展示、处理记录台账、Java 服务/API 验收记录、Java 模式桌面/移动截图验收、付款阻断处理记录非空回显、执行复核提示、复核动作清单、三单匹配刷新真实动作、差异处理复核定位、付款申请复核定位、付款申请复核定位反馈、付款申请复核定位推进、执行记录刷新提示、付款执行复核刷新入口、付款执行登记前置条件显性化、付款执行记录登记入口、付款登记后复核提示和付款登记后批次复核摘要；但尚未接真实支付、批量付款执行和银企直连，阻断处理状态尚未自动编排付款、三单或差异状态；批次审批仍是单级审批任务，尚未接入多级批次审批流。
- 差异处理闭环：当前第十七轮已支持从金额差异三单匹配记录生成差异处理台账，在差异未处理时阻断付款申请，并在差异处理后恢复付款申请；采购方应付对账台账已能汇总阻断和恢复队列，Java smoke 已覆盖阻断恢复联调；第62轮已在批次复核动作中展示待处理差异数量并支持定位到首个待处理差异发票。尚未驱动订单、收货或发票金额调整。
- 三单匹配留痕：当前第十二轮已按发票维度保存后端快照，并提供当前租户历史数据回填；第61轮已在付款批次复核动作中接入手动刷新三单匹配快照。尚未做定时重算和跨订单/多发票拆分匹配。
- Java 视觉验收：第58轮已补桌面和移动截图、DOM 文本检查、CORS 实测和付款阻断处理记录非空回显；后续如需更强结论，可再接入稳定 CDP/Playwright 以度量 `scrollWidth`。

## 暂不做

- 不接入新的业务域 Java API，本轮只在既有财务动作域内补三单异常到差异处理的联动端点。
- 不接真实支付、银企直连、税控开票和外部财务系统。
- 不进入合同、商城、竞价、招标、AI 或 ERP 深度集成。
