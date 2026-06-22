# 阶段十一执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 采购方主流程操作条 | 第1轮回到采购方主流程 polish，在采购需求、审批中心、询价项目、报价对比、采购订单、收货验收和发票付款 7 个页面统一增加操作条；每页集中展示当前页讲解重点、推荐点击动作、不可操作边界和下一页承接，提升产品可演示性 | `stage11-buyer-main-flow-operation-strip`、`scripts/stage-eleven-buyer-main-flow-operation-strip-ui.test.ts` |
| 2 | 采购方主流程页面一致性 polish | 第2轮继续收敛采购方 7 个核心页面，在主流程操作条里增加列表扫读、详情层级、空状态解释和按钮边界四项一致性提示；演示员可以按统一口径解释每页怎么看、点哪里、为什么不能点 | `stage11-buyer-main-flow-operation-strip`、`scripts/stage-eleven-buyer-main-flow-page-polish-ui.test.ts` |
| 3 | 采购方主流程视觉密度和移动端验收 | 第3轮补采购方主流程桌面/移动截图验收，覆盖采购需求、审批中心、询价项目、报价对比、采购订单、收货验收和发票付款；检查阶段十一操作条、页面一致性检查、无加载失败、无 React 错误、无整页横向溢出，并保留桌面/移动截图 | `scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs`、`docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json`、`docs/stage-eleven-buyer-main-flow-visual-density-result.md` |
| 4 | 采购方主流程移动端密度修补 | 第4轮针对视觉验收里移动端操作条高度偏高的问题做局部 UI 修补，压缩阶段十一操作条的移动端 padding、说明文、事实卡间距和事实卡文字行数；目标是把移动端操作条高度控制在演示可接受范围内，同时保留列表扫读、详情层级、空状态解释和按钮边界 | `stage11-buyer-main-flow-operation-strip--compact`、`scripts/stage-eleven-buyer-main-flow-mobile-density-polish.test.ts` |
| 5 | 采购方主流程首屏业务焦点修补 | 第5轮继续修补详情区首屏信息密度和列表卡片高度，把采购需求、审批中心、询价项目、报价对比、采购订单、收货验收和发票付款 7 页的当前选中、当前状态、详情首屏、列表卡片高度和下一步动作统一放到紧凑焦点栏，方便现场先讲业务对象再进入详情 | `stage11-buyer-first-screen-focus`、`scripts/stage-eleven-buyer-first-screen-focus-ui.test.ts` |
| 6 | 采购方主流程动作区可见性修补 | 第6轮继续修补关键按钮、禁用原因、详情区入口和点击后流向，把 7 个采购方主流程页面的“能不能点、为什么不能点、点完去哪”统一放到关键操作可用性面板，减少现场演示时寻找按钮和解释禁用态的成本 | `stage11-buyer-action-visibility`、`scripts/stage-eleven-buyer-action-visibility-ui.test.ts` |
| 7 | 采购方主流程演示数据瘦身 | 第7轮继续减少首屏非主线说明、压缩列表样本数量和保留推荐样本；采购方 7 个主流程页面统一最多展示 6 条演示优先样本，推荐样本会被前置保留，完整数据仍可通过搜索和筛选解释 | `stage11-buyer-demo-data-slimming`、`scripts/stage-eleven-buyer-demo-data-slimming-ui.test.ts` |
| 8 | 阶段十一演示收口验收包 | 第8轮把阶段十一采购方主流程 polish 收束成可交付演示包，补齐验收证据、7 页演示能力矩阵、三端演示路径复核、失败兜底、暂不声明范围和客户演示讲解稿 | `docs/stage-eleven-closeout-acceptance-package.md`、`docs/stage-eleven-customer-demo-runbook.md`、`scripts/stage-eleven-closeout-acceptance-package.test.ts` |

## 待补强

- 下一轮建议：进入阶段十二，优先基于阶段十一演示包做客户反馈清单、三端演示验收收口和下一业务域优先级决策。
- 本阶段继续产品可演示优先：先让采购方主流程更像可讲、可点、可验收的业务系统，再回头做更细的代码拆分和质量优化。

## 暂不做

- 不新增 Java API，不扩张后端模块。
- 不进入商城、竞价、招标、电子签章、ERP/OA/财务深度集成。
- 不把本轮操作条误写成完整流程编排器；它只是演示辅助和页面引导。
