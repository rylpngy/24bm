# 阶段四财务域总体验收矩阵

## 验收结论

阶段四财务域已经完成从发票付款提示到付款批次归档审计和归档异常申请台账的主干深化，可作为阶段四财务协同域的阶段性封版基线。

本基线的含义是：系统已经能支撑采购方在平台内完成付款前核对、差异阻断、付款申请、批次审批、执行登记、阻断处理、登记后复核、归档冻结和归档异常申请处理；同时必须保留“不接真实支付”的产品边界。它不是银行付款系统、税控开票系统或完整财务 ERP。

## 验收矩阵

| 能力域 | 已验收能力 | 当前判断 | 关键证据 |
| --- | --- | --- | --- |
| 三单匹配 | 发票维度保存订单金额、收货状态、发票金额、差异金额、匹配结论和付款准备状态；支持历史重建、手动刷新和 smoke 回查 | 可作为付款前控制基线封版 | `scripts/java-three-way-match-scaffold.test.ts`、`scripts/java-three-way-match-rebuild.test.ts`、`scripts/java-three-way-match-smoke.test.ts` |
| 差异处理 | 金额差异可生成或复用差异处理台账；未处理差异阻断付款申请；处理后恢复付款申请；批次复核中可定位待处理差异 | 可作为差异阻断闭环封版 | `scripts/java-three-way-match-variance-link.test.ts`、`scripts/payment-request-variance-blocking-ui.test.ts`、`scripts/java-three-way-match-variance-smoke.test.ts` |
| 付款申请 | Java `payment_requests` 已落库，支持创建、提交审批、通过审批、审计留痕、前端详情回显和对账台账队列汇总 | 可作为付款申请闭环封版 | `scripts/java-finance-action-ledger-scaffold.test.ts`、`scripts/finance-action-status-flow-ui.test.ts`、`scripts/finance-approval-audit-flow.test.ts` |
| 付款批次 | Java `payment_batches` 已落库，支持批次金额、已审批金额、申请数量、计划付款日、风险筛选、批次详情、批次审批任务和归档状态动作 | 可作为平台内付款计划与批次管理封版 | `scripts/java-payment-batch-scaffold.test.ts`、`scripts/java-payment-batch-status-flow.test.ts`、`scripts/java-payment-batch-smoke.test.ts` |
| 执行记录 | Java `payment_execution_records` 已提供执行状态、阻断原因、执行汇总、登记前置条件、专用登记入口和登记后复核提示 | 可作为平台内付款登记基线封版 | `scripts/java-payment-execution-record-scaffold.test.ts`、`scripts/payment-execution-registration-transition.test.ts`、`scripts/payment-batch-registration-review-summary-ui.test.ts` |
| 阻断处理 | Java `payment_block_resolutions` 已提供处理记录台账、页面写入、审计展示、处理记录非空回显、复核动作清单和上下文定位 | 可作为人工复核协同闭环封版 | `scripts/java-payment-block-resolution-scaffold.test.ts`、`scripts/payment-block-resolution-write-ui.test.ts`、`scripts/payment-block-resolution-ledger-ui.test.ts` |
| 归档冻结 | 批次归档前校验全部执行记录已登记；归档后写入审计摘要，冻结付款申请、差异处理、执行登记和阻断处理写入；详情展示归档审计面板 | 可作为只读审计闭环封版 | `scripts/payment-batch-archive-gate.test.ts`、`scripts/payment-batch-archive-freeze.test.ts`、`scripts/payment-batch-archive-audit-panel-ui.test.ts`、`scripts/stage-four-java-visual-check.test.ts` |
| 归档异常 | 已归档付款批次可提交归档异常申请、生成审批任务、回写审批结果、登记受控处理并关闭复核；Java smoke 已覆盖申请到回查链路 | 可作为归档后异常申请台账闭环封版 | `scripts/payment-batch-archive-exception-entry-ui.test.ts`、`scripts/java-payment-archive-exception-scaffold.test.ts`、`scripts/java-local-smoke.test.ts` |

## 封版判断

可以封版的范围：

- 采购方财务协同后台的付款前控制链路。
- 平台内付款申请、付款批次、执行记录和归档审计链路。
- 已归档付款批次的归档异常申请、审批、受控处理和关闭复核台账链路。
- 财务人员用于定位阻断原因、登记平台内付款状态、回看归档摘要的操作入口。
- Java 模式下发票付款、付款批次详情、处理记录台账和归档审计面板的演示基线。

不建议在本阶段继续扩大的范围：

- 不在阶段四内继续开启合同、商城、竞价、招标、AI 或 ERP 深度集成。
- 不把归档审计面板误包装成正式资金付款、财务凭证或银行回单。
- 不把归档异常申请误包装成自动解冻、自动重开或自动取消归档。
- 不把阻断处理保存动作改成自动推进付款、三单或差异状态的隐式编排。

## 必须保留边界

阶段四封版时必须保留边界如下：

- 不接真实支付、银企直连、税控开票、银行回单、批量付款执行。
- 登记付款状态只代表平台内状态登记，不代表真实资金划拨完成。
- 付款阻断处理状态不自动编排付款、三单或差异状态；需要通过现有复核入口显式刷新或定位处理。
- 已归档付款批次只允许审计查看，不允许付款申请、差异处理、执行登记或阻断处理继续写入。
- 归档异常申请只回写申请、审批、受控处理和关闭复核台账，不直接解冻或改写已归档付款批次。
- 三单匹配支持手动刷新和历史回填，尚未做定时重算、跨订单匹配或一票多单拆分匹配。
- 批次审批仍是单级审批任务，尚未接入多级审批、会签和可视化审批流。

## 验收证据

阶段四总体验收依赖以下既有收口文档和产物：

- 阶段四财务最终收口包：`docs/stage-four-finance-final-closeout-package.md`
- `docs/stage-four-finance-closeout-review.md`
- `docs/stage-four-payment-archive-closeout-review.md`
- `docs/stage-four-payment-archive-exception-closeout-review.md`
- `docs/stage-four-finance-deepening-checklist.md`
- `docs/stage-four-java-visual-walkthrough-result.md`
- `docs/artifacts/stage-four-java-visual-check-result.json`
- `docs/artifacts/stage-four-java-desktop-1280x720.png`
- `docs/artifacts/stage-four-java-mobile-390x844.png`

建议保留以下验收命令：

- `npm test -- scripts/stage-four-finance-final-closeout-package.test.ts scripts/stage-four-finance-acceptance-matrix.test.ts scripts/stage-four-finance-closeout-review.test.ts scripts/stage-four-payment-archive-closeout-review.test.ts scripts/stage-four-payment-archive-exception-closeout-review.test.ts scripts/stage-four-java-visual-check.test.ts`
- `npm test -- scripts/stage-four-finance-acceptance-matrix.test.ts scripts/stage-four-finance-final-closeout-package.test.ts scripts/stage-four-finance-closeout-review.test.ts scripts/stage-four-payment-archive-closeout-review.test.ts scripts/stage-four-payment-archive-exception-closeout-review.test.ts`
- `npm test`
- `npm run build`
- `npm run java:smoke`
- `JAVA_API_BASE_URL=http://localhost:18080 npm run java:smoke`
- `node scripts/stage-four-java-visual-check.mjs`
- `git diff --check`

## 下阶段入口

阶段四如果按 `docs/stage-four-finance-final-closeout-package.md` 和上述边界封版，下一阶段建议从以下三个入口选择其一，不建议并行铺开：

1. 付款归档异常设计深化：在现有申请台账闭环基础上，继续设计归档撤销动作、异常解冻、审批权限、审计追踪和冻结守卫扩展规则。
2. 真实支付前置设计：先设计付款凭证、幂等号、权限校验、失败重试、银行回单和异常恢复模型，再决定是否接银企直连。
3. 批次审批增强：补审批意见、审批历史、驳回路径，再评估多级审批、会签和审批流可视化配置。

如果业务侧希望从财务域切到新业务域，优先建议做合同管理或供应商绩效。商城、竞价、招标和 AI 能力牵涉新的交易规则、权限模型和验收口径，不建议与真实支付前置设计同时启动。
