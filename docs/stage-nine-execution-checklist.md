# 阶段九执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 三端演示总线第一轮 | 第1轮进入阶段九，把阶段七已验证的 17 个真实点击动作包装成三端现场演示总线；采购方强调需求到付款闭环，供应商强调报价到应收协同，平台端强调 SaaS 治理和运营动作。当前目标是产品可演示优先，先让演示者知道按什么主线讲、每端有几个真实动作、证据文件在哪里、下一页怎么翻 | `components/stageEightDemoPanels.tsx`、`App.tsx`、`scripts/stage-nine-demo-command-center-ui.test.ts` |
| 2 | 当前页动作提示第一轮 | 第2轮把阶段九演示总线和当前 activeModule 联动，在三端顶部按当前页面展示目标按钮、演示口径和跳转建议；采购方覆盖需求、审批、报价、收货、发票等真实动作入口，供应商覆盖商机、销售订单和发票应收，平台覆盖租户、企业审核和公告运营 | `components/stageEightDemoPanels.tsx`、`App.tsx`、`scripts/stage-nine-current-action-guide-ui.test.ts` |
| 3 | 优先演示样本提示第一轮 | 第3轮继续强化现场演示定位，在当前页动作提示中增加优先样本和样本定位；采购方、供应商、平台端均指向阶段七 seed 中的稳定样本 ID 或名称，帮助演示者快速找到最适合点击的卡片。本轮只做演示定位提示，不新增接口和保存能力 | `components/stageEightDemoPanels.tsx`、`App.tsx`、`scripts/stage-nine-priority-sample-guide-ui.test.ts` |
| 4 | 推荐演示样本卡片高亮第一轮 | 第4轮把顶部优先样本提示下沉到列表卡片，在通用工作流卡片、信息卡片和只读详情卡片中增加推荐演示样本徽标和浅蓝高亮；首轮覆盖采购方需求、审批、报价、收货、发票以及平台企业审核和公告卡片，降低现场查找样本成本 | `App.tsx`、`scripts/stage-nine-demo-sample-card-highlight-ui.test.ts` |
| 5 | 推荐演示样本卡片高亮第二轮 | 第5轮把推荐演示样本继续下沉到供应商商机、销售订单、发票应收和平台租户操作卡片；供应商侧覆盖报价、确认订单、提交发货、提交发票、保存对账备注的样本定位，平台租户侧覆盖启停、套餐升级和功能开关演示样本，并兼顾租户列表移动摘要卡 | `App.tsx`、`scripts/stage-nine-supplier-tenant-sample-highlight-ui.test.ts` |
| 6 | 演示顺序导航和当前页样本定位第一轮 | 第6轮把演示总线、演示路径和推荐样本连起来，在三端演示总线中增加上一页、下一页、定位推荐样本按钮；采购方、供应商、平台端均沿用现有 activeModule 状态切换，不新增路由库，定位动作只切换筛选和当前详情，帮助现场讲解从“知道样本在哪里”变成“按顺序点即可演示” | `components/stageEightDemoPanels.tsx`、`App.tsx`、`scripts/stage-nine-demo-sequence-navigation-ui.test.ts` |
| 7 | 演示准备检查面板第一轮 | 第7轮补齐三端演示准备检查面板，把 Java 数据源、17 个动作、推荐样本、前后端健康状态集中显示；采购方、供应商、平台端分别展示角色动作数量和阶段七证据文件，帮助现场开场前确认当前页面适合演示 | `components/stageEightDemoPanels.tsx`、`App.tsx`、`scripts/stage-nine-demo-readiness-panel-ui.test.ts` |
| 8 | 演示准备检查移动端密度第一轮 | 第8轮把 390px 视口下准备检查面板补到可读：检查摘要收成浅底短标签，检查项列表在移动端限定高度并可纵向滚动，桌面仍保留四列密度；本轮只优化演示开场信息密度，不新增接口和业务保存能力 | `components/stageEightDemoPanels.tsx`、`docs/stage-nine-execution-checklist.md`、`scripts/stage-nine-demo-readiness-mobile-density-ui.test.ts` |
| 9 | 阶段九现场视觉截图复跑 | 第9轮补阶段九现场视觉截图复跑，覆盖采购方、供应商、平台端的桌面/移动截图；检查 Java 数据源、演示总线、演示准备检查面板、加载失败、argument type mismatch、React runtime error、控制台 error 和整页横向溢出，形成阶段九可演示视觉证据 | `scripts/stage-nine-onsite-visual-acceptance-check.mjs`、`docs/stage-nine-onsite-visual-acceptance-result.md`、`docs/artifacts/stage-nine-onsite-visual-acceptance-result.json`、`scripts/stage-nine-onsite-visual-acceptance.test.ts` |
| 10 | 阶段九演示人讲解稿第一轮 | 第10轮补阶段九现场演示讲解稿，把截图证据、真实动作、推荐样本和三端边界串成一份可照读的演示 runbook；讲解稿覆盖演示前检查、采购方主线、供应商协同主线、平台运营主线、异常兜底、可声明范围和暂不声明范围 | `docs/stage-nine-demo-presenter-runbook.md`、`scripts/stage-nine-demo-presenter-runbook.test.ts` |
| 11 | 阶段九收口复盘与下一阶段决策表 | 第11轮补阶段九收口复盘与下一阶段实施决策表，明确当前真实完成度、仍需说明的缺口、验收证据和后续方向；推荐先完成演示版收口，再进入合同管理和财务深化，商城直采、竞价采购、招标和 AI 暂缓 | `docs/stage-nine-closeout-decision-review.md`、`scripts/stage-nine-closeout-decision-review.test.ts` |

## 待补强

- 阶段九下一轮建议继续围绕产品研发推进：按决策表进入阶段十，优先评估合同管理承接订单，其次评估财务深化动作闭环。
- 继续复核移动端 `390px` 视口下阶段九总线、阶段八面板和主列表的阅读密度。
- 如需补真实保存能力，只优先补 17 个演示动作中最影响讲解的缺口，不扩展到新采购方式。

## 暂不做

- 不进入商城、竞价、招标、AI 或 ERP 集成。
- 不做真实支付、税控开票、银行直连。
- 不做电子签章、法务模板库和合同生产级全生命周期。
- 不做套餐计费、用量统计、开放 API 和 Webhook。
- 不把阶段七验收通过误写成生产完成。
