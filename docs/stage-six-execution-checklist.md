# 阶段六执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 真实写入能力实施矩阵 | 第1轮已完成阶段六真实写入能力实施矩阵，按采购需求、RFQ、报价定标、采购订单、收货验收、发票付款和合同管理拆分已有 Java 写入、只有前端入口、需要补 API、需要补状态机四类差距，并确定第一实施泳道为采购需求写入补强 | `docs/stage-six-write-capability-matrix.md`、`scripts/stage-six-write-capability-matrix.test.ts` |
| 2 | 采购需求写入补强计划 | 第2轮已完成采购需求写入补强计划，明确采购需求创建、编辑、提交审批、审批通过、审批驳回、审批中禁改和已通过创建 RFQ 的正反路径；下一轮优先补采购需求 Java 状态流转测试和前端契约/UI 边界测试 | `docs/stage-six-demand-write-hardening-plan.md`、`scripts/stage-six-demand-write-hardening-plan.test.ts` |
| 3 | 采购需求提交审批审计补强 | 第3轮先补采购需求提交审批的 Java 审计轨迹，新增 `purchase_demand.submitted` 动作并在提交审批成功后记录租户审计日志；本轮不改变审批状态机、不新增表，只把采购需求写入样板中的提交动作纳入可追溯证据 | `backend-java/src/test/java/com/procurement/PurchaseDemandAuditLogTests.java`、`scripts/stage-six-demand-write-audit-hardening.test.ts` |
| 4 | 采购需求审批回写状态保护 | 第4轮补强采购需求审批回写的服务端并发保护：审批任务更新成功后，如果需求状态回写返回 0，会抛出明确错误，避免审批任务已完成但需求状态未同步；本轮不新增表，只补 Java 状态保护和测试 | `backend-java/src/test/java/com/procurement/PurchaseDemandApprovalStateTransitionTests.java`、`scripts/stage-six-demand-review-state-guard.test.ts` |
| 5 | 采购需求前端 UI 边界补强 | 第5轮补强采购需求详情页的前端写入边界说明，覆盖审批中禁改提示、重复提交保护、已通过创建 RFQ 准备提示和 Java 错误反馈文案；本轮不新增接口，只让现有 Java 写入入口的可操作/不可操作原因更清晰 | `App.tsx`、`scripts/stage-six-demand-ui-boundary-hardening.test.ts` |
| 6 | RFQ 供应商邀请列表状态保护 | 第6轮先补 RFQ 状态机中供应商邀请列表的服务端边界：创建或更新 RFQ 时必须至少一家供应商，且不能重复邀请同一家供应商；重复邀请会在删除旧邀请和写入 RFQ 前失败，避免形成空邀请或重复邀请台账 | `backend-java/src/test/java/com/procurement/RfqSupplierInvitationPolicyTests.java`、`backend-java/src/test/java/com/procurement/RfqUpdateQuotingTests.java`、`scripts/stage-six-rfq-invitation-state-guard.test.ts` |
| 7 | RFQ 截止时间与需求关联并发保护 | 第7轮补 RFQ 创建/更新的截止时间服务端规则，要求截止时间必须晚于当前时间；同时给 `rfq_demands` 增加 `(tenant_id, demand_id)` 唯一约束，并把并发重复创建导致的唯一冲突转换成“需求已关联 RFQ”的业务错误 | `backend-java/src/test/java/com/procurement/RfqSourcingStatusTransitionTests.java`、`backend-java/src/test/java/com/procurement/RfqCreationStateTransitionTests.java`、`backend-java/src/main/resources/db/migration/V118__rfq_demand_unique_link.sql`、`scripts/stage-six-rfq-deadline-and-demand-link-guard.test.ts` |
| 8 | 供应商报价截止与重复写入保护 | 第8轮补供应商报价写入边界：RFQ 截止后不能提交或修改报价；并发重复报价导致的唯一冲突转换成已提交报价的业务错误，避免数据库异常直接暴露到业务层 | `backend-java/src/test/java/com/procurement/SupplierQuoteListFilterTests.java`、`backend-java/src/test/java/com/procurement/RfqSourcingStatusTransitionTests.java`、`scripts/stage-six-supplier-quote-write-guard.test.ts` |
| 9 | 供应商报价提交/修改审计 | 第9轮补供应商报价写入审计：新增 `QuoteAuditAction.SUBMITTED` 和 `QuoteAuditAction.UPDATED`，供应商提交报价和修改报价成功后写入租户审计日志，目标类型统一为 `AuditTargetType.QUOTE`，为后续报价附件、定标前锁定和履约追踪保留可追溯证据 | `backend-java/src/test/java/com/procurement/SupplierQuoteAuditLogTests.java`、`backend-java/src/main/java/com/procurement/sourcing/domain/QuoteAuditAction.java`、`scripts/stage-six-supplier-quote-audit-guard.test.ts` |
| 10 | 报价附件边界与定标前报价锁定 | 第10轮补 RFQ 报价链路的服务端边界：`quote` 附件写入前必须绑定当前租户内真实报价，避免任意 ownerId 写入附件元数据；提交定标审批时，中选报价从 `QuoteStatus.SUBMITTED` 锁定为 `QuoteStatus.LOCKED`，若并发导致报价已变化则中止定标记录写入 | `backend-java/src/test/java/com/procurement/AttachmentMetadataLifecycleTests.java`、`backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java`、`scripts/stage-six-quote-attachment-and-award-lock-guard.test.ts` |
| 11 | 锁定报价修改拦截与定标驳回解锁 | 第11轮补锁定报价后续边界：供应商不能修改已锁定报价，服务端会在进入写入 Mapper 前返回明确业务错误；定标审批驳回后将中选报价从 `QuoteStatus.LOCKED` 恢复为 `QuoteStatus.SUBMITTED`，让 RFQ 回到报价中时可以重新处理报价 | `backend-java/src/test/java/com/procurement/SupplierQuoteListFilterTests.java`、`backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java`、`scripts/stage-six-award-rejection-unlock-guard.test.ts` |
| 12 | 定标通过报价收口与重复生成订单边界 | 第12轮补定标通过后的收口：中选报价从 `QuoteStatus.LOCKED` 变为 `QuoteStatus.AWARDED`，未中选报价从 `QuoteStatus.SUBMITTED` 变为 `QuoteStatus.NOT_SELECTED`；同时为采购订单增加 `purchase_orders_tenant_rfq_supplier_unique` 唯一约束，并把并发重复生成订单的唯一冲突转换为返回已生成订单 | `backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java`、`backend-java/src/test/java/com/procurement/OrderFulfillmentStateTransitionTests.java`、`backend-java/src/main/resources/db/migration/V119__purchase_order_award_unique_source.sql`、`scripts/stage-six-award-order-closeout-guard.test.ts` |
| 13 | 订单生成后的 RFQ/报价只读提示和前端操作边界 | 第13轮补订单生成后的前端可见边界：订单已生成后，RFQ 和报价进入只读跟踪，操作面板明确提示定标结果和报价状态不可再变更；RFQ 卡片展示 `已中选`、`未中选`、`已锁定` 报价状态，方便采购方理解后续只能进入订单、收货和发票付款链路 | `data/procurementModel.ts`、`data/buyerWorkflow.ts`、`App.tsx`、`scripts/stage-six-post-order-readonly-ui.test.ts` |
| 14 | 阶段六真实写入能力收口复盘 | 第14轮完成阶段六收口复盘，按采购需求、RFQ、供应商报价、报价附件与定标、定标到订单和订单后只读跟踪梳理已完成能力、验收证据、仍需保留边界和阶段七建议入口 | `docs/stage-six-closeout-review.md`、`scripts/stage-six-closeout-review.test.ts` |

## 待补强

- 采购需求写入补强：已完成基础 Java 写入审计、审批回写保护和前端 UI 边界提示；后续只在真实联调发现缺口时补小修。
- RFQ 状态机：阶段六已完成询价比价主流程的关键写入边界，阶段七结合 Java 模式真实演示闭环继续补联调小缺口。
- 定标到订单：已完成定标审批、报价锁定/解锁、报价收口、重复生成订单边界和订单后只读提示；阶段七重点验证真实页面按钮状态和错误反馈。
- 统一详情表单体系：当前 `App.tsx` 承载了大量模块操作，阶段六需要逐步沉淀可复用表单、操作反馈和只读边界。
- 阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化。

## 暂不做

- 不进入商城、竞价、招标、AI 或真实支付。
- 不同时重构采购需求、RFQ、订单、发票付款和合同。
- 不把阶段五前端辅助提示改写成已完成的后端工作流。
