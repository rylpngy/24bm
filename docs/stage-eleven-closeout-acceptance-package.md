# 阶段十一采购方主流程演示收口验收包

## 收口结论

阶段十一采购方主流程 polish 已达到产品可演示阶段目标。

当前可以稳定讲清采购方 7 个主流程页面：采购需求、审批中心、询价项目、报价对比、采购订单、收货验收和发票付款。每个页面都具备操作条、首屏业务焦点、动作区可见性和演示数据瘦身，能让演示人员按同一节奏讲清“当前业务对象、能点什么、为什么不能点、点完去哪”。

本收口包只声明采购方主流程演示体验达到阶段目标，不声明完整采购管理系统已经生产级完成。

## 验收证据

| 证据 | 证明内容 |
| --- | --- |
| `docs/stage-eleven-execution-checklist.md` | 记录阶段十一 8 轮采购方主流程 polish 和收口进度。 |
| `docs/stage-eleven-buyer-main-flow-visual-density-result.md` | 记录采购方 7 页桌面和移动视觉验收结论。 |
| `docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json` | 14 个页面/视口组合失败项为 0，检查 Java 数据源、操作条、首屏业务焦点、动作区可见性、演示数据瘦身和横向溢出。 |
| `docs/stage-eleven-customer-demo-runbook.md` | 阶段十一客户演示讲解稿，覆盖采购方 7 页顺序、供应商和平台如何衔接、结束话术。 |
| `docs/artifacts/stage-seven-onsite-demo-acceptance-result.json` | 三端 17 个真实动作的基础验收结果，证明采购方、供应商和平台端不是静态页面。 |
| `docs/stage-nine-demo-presenter-runbook.md` | 三端现场演示总讲解稿，可作为阶段十一采购方深化讲解的上层脚本。 |
| `docs/stage-ten-contract-closeout-review.md` | 合同线已阶段性收口，阶段十一回到采购方主流程 polish 的决策依据。 |

建议保留的验收命令：

```bash
node scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs
npm test -- scripts/stage-eleven-closeout-acceptance-package.test.ts scripts/stage-eleven-buyer-demo-data-slimming-ui.test.ts scripts/stage-eleven-buyer-action-visibility-ui.test.ts scripts/stage-eleven-buyer-first-screen-focus-ui.test.ts scripts/stage-eleven-buyer-main-flow-operation-strip-ui.test.ts scripts/stage-eleven-buyer-main-flow-page-polish-ui.test.ts scripts/stage-eleven-buyer-main-flow-visual-density.test.ts scripts/stage-eleven-buyer-main-flow-mobile-density-polish.test.ts scripts/stage-seven-demo-presentation-polish-ui.test.ts
npm run build
git diff --check
curl -I http://localhost:3000/
curl http://localhost:8080/api/v1/health
```

## 演示能力矩阵

| 页面 | 当前演示重点 | 关键可见能力 | 验收口径 |
| --- | --- | --- | --- |
| 采购需求 | 从需求申请、预算、附件和物料明细进入审批或询价 | 操作条、首屏业务焦点、提交审批、创建询价入口、演示数据瘦身 | 能讲清需求为什么先审批，什么时候可创建询价。 |
| 审批中心 | 审批对象、处理意见、通过或驳回动作 | 操作条、首屏业务焦点、动作区可见性、审批待办样本 | 能讲清内控节点和审批后的业务流向。 |
| 询价项目 | RFQ 摘要、邀请供应商、截止时间和报价数量 | 操作条、首屏业务焦点、供应商邀请、列表扫读 | 能讲清询价从已审批需求产生，并进入报价对比。 |
| 报价对比 | 报价矩阵、推荐理由、定标审批和生成订单 | 操作条、动作区可见性、推荐样本保留、按钮边界 | 能讲清定标不是直接下单，审批通过后才生成订单。 |
| 采购订单 | 供应商确认、履约时间线、发货和收货入口 | 操作条、首屏业务焦点、登记收货入口、下一页承接 | 能讲清订单如何承接定标结果并进入履约。 |
| 收货验收 | 物流状态、验收结果、异常原因和发票衔接 | 操作条、动作区可见性、待收货推荐样本、详情层级 | 能讲清收货是发票付款前置条件。 |
| 发票付款 | 对账差异、付款计划、逾期提醒和付款登记 | 操作条、首屏业务焦点、付款入口、演示数据瘦身 | 能讲清当前只登记付款状态和审计留痕，不触发真实支付。 |

## 入口地址

- 采购方演示起点：`http://localhost:3000/?role=buyer&module=demands`
- 采购方审批页：`http://localhost:3000/?role=buyer&module=approvals`
- 采购方询价页：`http://localhost:3000/?role=buyer&module=rfqs`
- 采购方报价页：`http://localhost:3000/?role=buyer&module=quotes`
- 采购方订单页：`http://localhost:3000/?role=buyer&module=orders`
- 采购方收货页：`http://localhost:3000/?role=buyer&module=receipts`
- 采购方发票付款页：`http://localhost:3000/?role=buyer&module=invoices`
- 后端健康检查：`http://localhost:8080/api/v1/health`

页面顶部应显示 `Java 数据源`。

## 三端演示路径复核

阶段十一重点是采购方主流程 polish，但仍要沿用阶段七和阶段九的三端叙事：

| 角色 | 当前作用 | 复核口径 |
| --- | --- | --- |
| 采购方 | 主演示入口，负责需求、审批、询价、定标、订单、收货和付款登记 | 阶段十一已经把 7 页讲解顺序和首屏信息密度收束到可演示状态。 |
| 供应商 | 协同侧，负责报价、确认订单、发货、提交发票和应收备注 | 使用阶段七 5 个真实动作证明供应商侧不是静态页面。 |
| 平台端 | SaaS 运营侧，负责租户、企业审核和公告 | 使用阶段七 5 个真实动作证明平台只做治理，不参与采购业务决策。 |

现场仍可用 `17 个真实动作` 作为“三端不是静态 UI”的证据，但阶段十一的新增价值是采购方 7 页更容易讲、容易定位、容易解释边界。

## 失败兜底

如果页面打不开：

1. 执行 `curl -I http://localhost:3000/`，确认前端返回 200。
2. 执行 `curl http://localhost:8080/api/v1/health`，确认后端返回 `success: true`。
3. 刷新页面后确认顶部显示 `Java 数据源`。

如果页面出现“加载失败”、`argument type mismatch` 或 React runtime error：

1. 先执行 `node scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs`。
2. 查看 `docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json` 的 `failed` 字段。
3. 如果失败集中在一个页面，使用对应入口地址单页打开复核。

如果演示人员找不到按钮或推荐样本：

1. 先看页面上方的操作条，确认当前页推荐点击动作。
2. 再看首屏业务焦点，确认当前选中记录、状态和下一步动作。
3. 再看动作区可见性，确认主按钮位置、禁用原因、详情区入口和点击后流向。
4. 最后看演示数据瘦身区域，确认当前页只展示主流程优先样本，完整结果仍可搜索和筛选。

## 暂不声明

阶段十一不声明以下能力已经完成：

- 真实支付、税控开票、电子签章。
- ERP/OA/财务系统深度集成。
- 商城直采、竞价采购、复杂招标、专家评审、保证金。
- AI 供应商推荐、智能审批、支出分析和高级 BI。
- 生产级计费套餐、用量统计、公共供应商市场、开放 API 和 Webhook。
- 完整生产级权限矩阵、全量安全审计和性能压测。
- 不把阶段十一操作条误写成完整流程编排器，它只是演示辅助和页面引导。
- 不把演示数据瘦身误写成生产分页、权限过滤或性能优化能力。

## 收口判断

阶段十一可以作为采购方主流程演示 polish 的阶段性收口。

当前最适合的下一步不是继续在采购方 7 页堆细节，而是进入阶段十二：围绕可演示版本做三端演示验收收口、客户反馈清单和下一业务域优先级决策。若客户现场反馈仍集中在采购方主流程，再回到具体页面做小步修补；如果客户已经认可主流程，可进入商城直采、竞价采购、平台运营、供应商市场或生产级治理的下一阶段评估。
