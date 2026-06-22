# 阶段四财务深化收口复核

## 验收结论

阶段四财务深化已经从最初的三单匹配摘要，推进到可演示的采购方财务协同后台链路。第1轮到第71轮覆盖了三单匹配、差异处理、付款申请、付款批次、执行记录、阻断处理和登记后复核。

当前结论是：阶段四可以作为“财务协同深化阶段性成果”进入收口复核，但还不是完整付款执行系统。系统已经能解释发票为什么不能付款、应该先处理哪个差异或付款申请、处理后需要刷新哪些记录，以及登记付款后如何回看批次状态；但尚未接真实支付、批量付款执行和银企直连。

## 已完成能力

- 三单匹配：采购方发票详情、应付对账台账和后端 `three_way_matches` 已覆盖订单金额、收货状态、发票金额、差异金额、匹配结论和付款准备状态；支持历史快照重建和 Java smoke 回查。
- 差异处理：金额差异可生成或复用差异处理台账；差异未处理时阻断付款申请；差异处理后可恢复付款申请；Java smoke 已覆盖阻断和恢复联调。
- 付款申请：已具备 Java `payment_requests` 落库、列表、创建、状态流转、单级审批任务、审计留痕、前端详情展示和对账台账队列汇总。
- 付款批次：已具备 Java `payment_batches` 台账、批次金额、已审批金额、申请数量、批次状态、计划付款日、风险筛选、详情侧栏、批次审批任务化和批次状态动作。
- 执行记录：已具备 Java `payment_execution_records` 只读台账、执行状态、执行阻断原因、批次执行汇总、登记前置条件、登记放行判断和登记付款状态入口。
- 阻断处理：已具备 Java `payment_block_resolutions` 台账、查询、创建、更新状态、审计信息、处理记录台账、非空回显、复核动作清单和上下文定位。
- Java 视觉验收：已通过 Chrome CLI 生成桌面 `1280x720` 和移动 `390x844` 截图，并通过 DOM 检查确认 Java 数据源、发票付款、付款批次详情、处理记录台账和阻断处理记录无加载失败。

## 完成度矩阵

| 能力域 | 当前完成度 | 形态判断 |
| --- | --- | --- |
| 三单匹配 | 已有后端快照、历史重建、前端摘要、对账台账展示和 smoke 回归 | 真实闭环 |
| 差异处理 | 已有后端台账、生成/复用、状态流转、阻断恢复和 Java smoke 联调 | 真实闭环 |
| 付款申请 | 已有后端台账、状态流转、单级审批任务、审计和前端回显 | 真实闭环 |
| 付款批次 | 已有后端台账、批次状态、风险筛选、详情侧栏、单级批次审批和执行汇总 | 真实闭环 |
| 执行记录 | 已有 Java 只读台账、阻断原因、登记前置条件和登记付款状态入口 | 部分真实闭环 |
| 阻断处理 | 已有 Java 处理记录、页面写入、审计展示、非空回显和复核动作定位 | 部分真实闭环 |
| 登记后复核 | 已有登记后复核提示、批次复核摘要和下一步建议 | 入口/只读/提示 |
| 真实资金执行 | 未接银行、银企直连、付款回单、批量执行和失败重试 | 暂不做 |

## 收口边界

阶段四当前的财务能力重点是“付款前控制”和“付款登记后复核”，不是完整资金系统。

明确边界如下：

- 尚未接真实支付、批量付款执行和银企直连。
- 尚未接税控开票、外部财务系统、真实银行回单和付款失败重试。
- 尚未实现多级批次审批、会签、审批流可视化配置。
- 尚未驱动订单、收货或发票金额自动调整。
- 三单匹配支持手动刷新和历史回填，尚未做定时重算、跨订单匹配或一票多单拆分匹配。
- 付款阻断处理状态只影响复核提示，不自动编排付款、三单或差异状态。
- 登记付款状态仍是平台内状态登记，不代表真实资金划拨完成。

## 验收证据

本阶段关键测试和文档入口包括：

- `scripts/buyer-three-way-match-ui.test.ts`
- `scripts/buyer-finance-action-java-integration-ui.test.ts`
- `scripts/finance-action-status-flow-ui.test.ts`
- `scripts/finance-approval-audit-flow.test.ts`
- `scripts/java-three-way-match-smoke.test.ts`
- `scripts/java-three-way-match-variance-smoke.test.ts`
- `scripts/java-payment-batch-smoke.test.ts`
- `scripts/payment-batch-resolution-context-link-ui.test.ts`
- `scripts/payment-block-resolution-write-ui.test.ts`
- `scripts/payment-block-resolution-ledger-ui.test.ts`
- `scripts/payment-batch-execution-registration-action-ui.test.ts`
- `scripts/payment-batch-registration-review-summary-ui.test.ts`
- `scripts/stage-four-java-visual-check.test.ts`
- `docs/stage-four-finance-deepening-checklist.md`
- `docs/stage-four-java-visual-walkthrough-result.md`

本轮收口建议保留以下验证命令作为阶段性验收基线：

- `npm test -- scripts/stage-four-finance-closeout-review.test.ts scripts/stage-four-finance-deepening-checklist.test.ts scripts/stage-four-java-visual-check.test.ts`
- `npm test`
- `npm run build`
- `npm run java:smoke`
- `node scripts/stage-four-java-visual-check.mjs`
- `git diff --check`

## 待补强

- 执行记录当前仍偏只读和登记提示，下一步可把付款登记、登记复核、执行记录刷新做成更明确的后端状态机。
- 阻断处理记录已经可保存，但尚未自动触发三单刷新、差异关闭、付款申请推进或执行记录重算。
- 付款批次审批仍是单级审批任务，尚未做多级审批、会签和审批流配置。
- 差异处理尚未驱动订单、收货或发票金额调整，也没有差异责任归因、附件证明和关闭规则。
- 付款申请和付款批次尚未接真实付款凭证、银行回单、失败重试、幂等控制和批量执行。
- Java 视觉验收已有 DOM 与截图证据，后续如需更强结论，可接入稳定 CDP 或 Playwright 度量 `scrollWidth` 和关键控件可点击性。

## 下一轮建议

下一轮建议优先继续做财务动作闭环，而不是马上转去新业务域。原因是阶段四已经把财务对象建起来了，继续补动作闭环的收益最高。

建议顺序：

1. 付款执行状态机：把付款登记、登记后复核、执行记录刷新和批次归档收口成后端状态流，保留“不接真实支付”的边界。
2. 阻断处理自动复核：保存阻断处理状态后，可显式触发三单刷新、差异复核和付款申请复核，并写入统一审计事件。
3. 批次审批增强：先补批次审批意见、审批历史和驳回路径，再考虑多级审批。
4. 差异处理深化：补差异原因分类、责任方、证明附件入口和关闭规则，暂不自动改金额。
5. 真实支付前置设计：在接银行或银企直连前，先补幂等号、权限、审计、失败重试、回滚和异常恢复设计。
