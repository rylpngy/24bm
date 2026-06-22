# 阶段五合同管理 MVP 收口验收包

## 收口结论

阶段五合同管理 MVP 已经形成采购方后台里的合同业务基线：合同可以从采购订单承接为台账，支持 Java 合同新建编辑保存、合同审批、状态推进、归档写入、附件元数据、履约事件、审计查看、付款计划只读聚合和归档复核辅助视图。

当前合同模块的产品定位是：采购方平台内合同台账、合同审批、履约协同、归档审计和归档前人工复核辅助，不得误读为完整法务合同系统、电子签章系统或外部合同生命周期管理系统。

## Java 真实能力

| 能力 | 当前可验收结果 | 仍需说明的边界 |
| --- | --- | --- |
| 合同台账读取 | 采购方合同管理页可读取 Java `/api/v1/buyer/contracts` 合同台账，展示合同编号、合同名称、供应商、金额、状态、生效日期、履约进度和归档状态 | Mock 模式仍可用派生数据兜底，Java 模式才作为主要验收路径 |
| 合同新建编辑保存 | 已支持基于采购订单创建合同台账，并编辑未归档合同的编号、名称、金额、状态、生效日期和履约进度 | 已归档合同不允许继续编辑；尚未做合同条款结构化、法务红线和合同版本对比 |
| 合同审批任务 | 已支持提交合同审批，审批中心可处理 `contract_approval`，审批通过后合同生效，驳回后回到草案 | 当前仍是单级审批，不支持多级审批、会签、审批意见持久化和可视化流程配置 |
| 合同状态推进和归档写入 | 已支持合同履约状态推进和归档写入；Java 服务端归档门禁会校验关联订单收货和发票付款状态 | 归档只代表平台内只读审计状态，不代表电子签章、法务确认或外部合同系统归档 |
| 合同附件元数据、上传凭证和下载签名 | 已支持合同附件元数据登记、上传凭证生成和下载签名生成，并按租户隔离 ownerType/ownerId | 仍未接真实对象存储、文件预览、病毒扫描、在线编辑或电子签章 |
| 合同履约事件台账 | 已支持从合同联动入口写入合同履约事件，事件包含目标单据、动作摘要和后端审计动作 | 仍是轻量事件台账，不是复杂履约状态机，不自动编排订单、收货或付款状态 |
| 合同目标审计查询 | 已支持合同目标对象审计日志查看，归档样例可回查履约事件审计动作 | 尚未提供审计导出、打印、长期归档包或外部审计系统对接 |

## 前端辅助提示

| 辅助视图 | 当前作用 | 验收边界 |
| --- | --- | --- |
| 合同履约联动摘要 | 从订单、收货、发票付款和归档状态派生履约阶段、风险等级、进度和下一步动作 | 只做采购方后台可读性增强，不自动改写后端状态 |
| 合同上下文操作入口 | 可从合同详情跳转到收货验收、发票付款和归档动作，并在目标页保留合同来源提示 | 复用现有模块切换，不创建独立合同工作流引擎 |
| 合同联动结果回看 | 目标页完成收货或付款后，合同详情展示最近联动动作、目标单据和处理摘要 | 页面内回看为主，后端真实沉淀依赖履约事件台账 |
| 合同付款计划只读视图 | 聚合关联发票、付款申请、付款批次、计划付款日和只读边界 | 不是独立合同付款计划接口，不登记真实付款，不接真实支付 |
| 归档复核辅助视图 | 已形成归档复核清单、缺口定位、处理建议、历史风险和归档前动作提示 | 归档复核清单、缺口定位、处理建议、历史风险和归档前动作提示不替代 Java 服务端归档门禁 |
| 归档前确认动作提示 | 将关闭前检查结果映射为归档按钮判断、阻断处理路径和归档动作提示 | 仍是前端辅助提示，最终提交继续由 Java 服务端归档门禁校验 |

## 尚未完成边界

阶段五收口时必须明确以下能力尚未完成，不能在验收或演示中扩大承诺：

- 真实对象存储、文件预览、病毒扫描、电子签章。
- 合同条款结构化、法务红线批注、合同版本对比、补充协议和变更申请。
- 多级审批、会签、审批意见持久化、审批历史详情和审批流可视化配置。
- 后端复杂履约事件状态机、履约节点自动编排、跨模块事务补偿和定时风险扫描。
- 独立合同付款计划接口、真实支付、银企直连、批量付款执行、银行回单和税控开票。
- 归档复核审批接口、归档撤销、归档解冻、归档重开和归档复核任务流。
- 外部合同系统、ERP、OA、财务系统和电子签章平台集成。

## 验收证据

建议按以下证据组合验收阶段五合同管理 MVP：

| 证据类型 | 证据入口 |
| --- | --- |
| 信息架构 | `docs/stage-five-contract-information-architecture.md` |
| 执行清单 | `docs/stage-five-execution-checklist.md` |
| Java 视觉验收 | `docs/stage-five-java-visual-walkthrough-result.md`、`docs/artifacts/stage-five-java-visual-check-result.json`、`docs/artifacts/stage-five-java-cdp-visual-check-result.json` |
| Java 合同能力测试 | `backend-java/src/test/java/com/procurement/ContractSaveActionTests.java`、`backend-java/src/test/java/com/procurement/ContractStatusActionTests.java`、`backend-java/src/test/java/com/procurement/ContractApprovalFlowTests.java`、`backend-java/src/test/java/com/procurement/ContractFulfillmentEventTests.java` |
| 前端合同验收脚本 | `scripts/stage-five-contract-*.test.ts` |
| 本地主流程 smoke | `scripts/java-local-smoke.mjs`、`scripts/java-local-smoke.test.ts` |

建议执行以下命令作为收口包验证：

- `npm test -- scripts/stage-five-closeout-acceptance-package.test.ts`
- `npm test -- scripts/stage-five-contract-information-architecture.test.ts scripts/stage-five-contract-ui-skeleton.test.ts scripts/stage-five-contract-java-data-ui.test.ts scripts/stage-five-contract-save-actions.test.ts scripts/stage-five-contract-approval-entry-ui.test.ts scripts/stage-five-contract-attachment-signed-url-ui.test.ts`
- `npm test -- scripts/stage-five-contract-archive-review-checklist-ui.test.ts scripts/stage-five-contract-archive-review-action-suggestions-ui.test.ts scripts/stage-five-contract-archive-review-pre-archive-action-hint-ui.test.ts`
- `npm run build`
- `npm test`
- `npm run java:smoke`
- `git diff --check`

## 阶段六建议入口

阶段五收口后，阶段六建议不要继续无限叠加只读提示，而是优先补真实写入能力和统一详情表单体系。

推荐优先级如下：

1. 优先补真实写入能力：把采购需求、RFQ、报价定标、订单、收货、发票付款和合同的核心创建/编辑/状态流转统一接到 Java API，减少仅页面提示的入口。
2. 统一详情页和表单体系：沉淀通用详情面板、编辑表单、操作反馈、只读边界和错误提示，降低当前 `App.tsx` 继续膨胀的维护风险。
3. 审批能力深化：补审批意见、审批历史、驳回原因、审批模板配置和多级审批雏形。
4. 附件能力真实化：从元数据和签名占位进入真实对象存储、文件预览、病毒扫描和权限校验。
5. 合同归档复核后端化：把当前前端复核清单逐步沉淀为 Java 归档复核任务、复核结论、证据确认记录和审计日志。

不建议阶段六一开始进入商城、竞价、招标、AI 或真实支付。原因是采购主流程的写入能力、审批记录和附件真实化仍需要先稳定。
