# 阶段六真实写入能力收口复盘

## 收口结论

阶段六已经完成采购主流程里最关键的真实写入能力补强：采购需求提交审批有审计和审批回写保护，RFQ 创建/更新有供应商邀请、截止时间和需求唯一关联保护，供应商报价有截止、重复提交、修改和审计保护，定标链路有报价附件、报价锁定/解锁、定标通过后的报价收口和重复生成订单边界。

当前阶段六的产品定位是：把阶段三到阶段五形成的采购方后台入口，补成更可信的 Java 写入和状态机基线。它不是完整采购平台终局，不应被解释为已经完成商城、竞价、招标、真实支付、ERP 集成或高级审批配置。

## 真实写入能力

| 主线 | 当前可验收能力 | 仍需说明的边界 |
| --- | --- | --- |
| 采购需求 | 已补采购需求提交审批审计，审批任务完成后需求状态回写失败会中止并报错，前端也补了审批中禁改、重复提交保护和已通过创建 RFQ 提示 | 仍是固定审批模板；暂未做多级审批、审批意见持久化、字段级权限和复杂预算校验 |
| RFQ 创建与更新 | 已补供应商邀请列表必须非空、不能重复邀请同一供应商，截止时间必须晚于当前时间，需求只能唯一关联一个 RFQ | 当前优先保护主流程数据一致性；暂未做复杂 RFQ 版本、复制 RFQ、批量改价规则和自动截标任务 |
| 供应商报价 | 已补 RFQ 截止后禁止提交或修改报价，并发重复报价会转为业务错误；供应商提交和修改报价会写入租户审计日志 | 暂未做报价撤回审批、报价分项明细、阶梯价、币种、保证金或实时竞价 |
| 报价附件与定标 | 已补报价附件 owner 校验，提交定标审批前会锁定中选报价，审批驳回会解锁报价，避免附件和定标记录脱离真实报价 | 附件仍是元数据和签名占位，未接真实对象存储、预览、病毒扫描或长期归档 |
| 定标到订单 | 已补定标通过后的报价收口：中选报价进入 `已中选`，未中选报价进入 `未中选`；采购订单增加 RFQ/供应商唯一来源约束，重复生成会返回已生成订单 | 当前只覆盖询价比价主流程，不覆盖招标评审、专家评分、竞价排名或多轮谈判 |
| 订单后只读跟踪 | 前端已在订单生成后提示 RFQ 和报价进入只读跟踪，报价卡片展示 `已中选`、`未中选`、`已锁定`，引导后续进入采购订单、收货验收和发票付款 | 主要是前端操作边界和状态可读性，后续仍需 Java 模式浏览器逐页演示确认 |

## 阶段六增量对齐

- 采购需求提交审批审计：提交审批成功后写入租户审计日志。
- RFQ 截止时间与需求关联并发保护：截止时间必须晚于当前时间，需求只能唯一关联一个 RFQ。
- 供应商报价截止与重复写入保护：截止后禁止提交或修改报价，并发重复报价转为业务错误。
- 报价附件边界与定标前报价锁定：报价附件必须绑定当前租户真实报价，提交定标审批前锁定中选报价。
- 定标通过报价收口与重复生成订单边界：中选报价和未中选报价完成状态收口，重复生成订单返回既有订单。
- 订单生成后的 RFQ/报价只读提示：订单生成后 RFQ 和报价进入只读跟踪，后续从订单、收货和发票付款继续履约。

## 前端操作边界

| 页面/模块 | 当前作用 | 验收边界 |
| --- | --- | --- |
| 采购需求详情 | 提示审批中禁改、重复提交保护、Java 错误反馈和 RFQ 创建准备状态 | 页面提示不替代服务端状态机，最终写入仍由 Java API 拦截 |
| 询价项目详情 | 展示供应商邀请、报价响应、定标结果、订单状态和下一步动作 | 不新增详情路由，仍沿用当前 `activeRole` / `activeModule` 状态切换 |
| 报价对比 | 展示推荐报价、中选报价、未中选报价、定标审批状态和订单生成状态 | 推荐算法已兼容已收口报价，但不代表完整评标模型 |
| RFQ 卡片 | 展示报价状态和订单后只读提示，帮助采购方理解 RFQ 已转入履约链路 | 只读边界需继续在 Java 真实页面验收中检查按钮禁用、错误反馈和移动端布局 |

## 仍需保留的边界

- 不进入商城、竞价、招标、AI 或真实支付。
- 不把阶段六写入基线扩大解释为完整审批流、完整附件中心、完整合同系统或完整财务系统。
- 不接真实对象存储、税控开票、银企直连、ERP、OA 或财务系统深度集成。
- 不做复杂评标规则、专家评审、保证金、多轮报价或实时竞价。
- 不把前端只读提示当作唯一安全边界；关键状态仍必须由 Java 服务端校验。
- 不继续让 `App.tsx` 无限膨胀，阶段七开始应结合真实联调逐步抽取高风险表单和详情能力。

## 验收证据

| 证据类型 | 证据入口 |
| --- | --- |
| 执行清单 | `docs/stage-six-execution-checklist.md` |
| 写入能力矩阵 | `docs/stage-six-write-capability-matrix.md` |
| 采购需求写入计划 | `docs/stage-six-demand-write-hardening-plan.md` |
| Java RFQ/报价/定标测试 | `backend-java/src/test/java/com/procurement/RfqSupplierInvitationPolicyTests.java`、`backend-java/src/test/java/com/procurement/RfqSourcingStatusTransitionTests.java`、`backend-java/src/test/java/com/procurement/SupplierQuoteListFilterTests.java`、`backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java` |
| Java 订单重复生成测试 | `backend-java/src/test/java/com/procurement/OrderFulfillmentStateTransitionTests.java` |
| 前端阶段六脚本 | `scripts/stage-six-*.test.ts` |
| 本轮收口复盘测试 | `scripts/stage-six-closeout-review.test.ts` |

建议执行以下命令作为阶段六收口验收基线：

- `npm test -- scripts/stage-six-closeout-review.test.ts`
- `npm test -- scripts/stage-six-post-order-readonly-ui.test.ts scripts/stage-six-award-order-closeout-guard.test.ts scripts/stage-six-award-rejection-unlock-guard.test.ts scripts/stage-six-quote-attachment-and-award-lock-guard.test.ts scripts/stage-six-supplier-quote-audit-guard.test.ts scripts/stage-six-supplier-quote-write-guard.test.ts scripts/stage-six-rfq-deadline-and-demand-link-guard.test.ts scripts/stage-six-rfq-invitation-state-guard.test.ts scripts/stage-six-write-capability-matrix.test.ts scripts/stage-six-demand-write-hardening-plan.test.ts scripts/stage-six-demand-write-audit-hardening.test.ts scripts/stage-six-demand-review-state-guard.test.ts scripts/stage-six-demand-ui-boundary-hardening.test.ts`
- `npm run build`
- `npm test`
- `mvn -q test`
- `git diff --check`
- `curl -I http://localhost:3000/`
- `curl http://localhost:8080/api/v1/health`

## 阶段七建议入口

阶段六收口后，阶段七建议优先进入 Java 模式真实演示闭环和页面细节打磨，而不是继续扩展新业务域。

推荐优先级如下：

1. Java 模式真实演示闭环：按采购需求、审批、询价、报价对比、订单、收货、发票付款逐页验收，确认无加载失败、无运行时错误、无横向溢出、按钮状态和错误反馈可解释。
2. 主流程演示路径固化：把需求申请、审批、创建询价、供应商报价、定标、生成订单、收货、发票付款整理成可重复演示路径和数据准备说明。
3. 页面细节修复：优先处理空状态、禁用态、只读态、移动端布局、列表密度、反馈文案和跨模块返回路径。
4. 表单和详情能力抽取：从 `App.tsx` 中优先抽离高频表单、详情面板和操作反馈，降低后续继续扩展的维护风险。
5. 仅补主流程缺口接口：真实联调发现缺少保存能力时，只补主流程必须接口，不同时进入商城、竞价、招标、合同增强、AI 或 ERP 集成。
