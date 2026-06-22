# 阶段七执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | Java 模式采购主流程演示闭环验收脚本 | 第1轮建立阶段七 Java 模式采购主流程演示闭环验收脚本，覆盖采购需求、审批中心、询价项目、报价对比、采购订单、收货验收、发票付款 7 个采购方核心页面，并要求桌面 1280x720 与移动 390x844 截图、DOM 文本、Java 数据源和失败信号检查 | `scripts/stage-seven-java-walkthrough.mjs`、`scripts/stage-seven-java-walkthrough.test.ts`、`docs/stage-seven-java-walkthrough-result.md` |
| 2 | 产品可演示优先研发方式调整 | 第2轮将阶段七执行方式调整为产品可演示优先：暂停扩展新模块，不再以自动化视觉脚本作为主要推进方式，优先围绕采购方 7 页主流程做可见体验改进 | `docs/product-demo-first-development-strategy.md`、`scripts/product-demo-first-strategy.test.ts` |
| 3 | 采购需求与审批中心演示体验第一轮 | 第3轮先补采购需求和审批中心的可见演示体验：采购需求页新增“需求到审批演示台”，审批中心新增“审批处理演示台”，让演示者能直接讲清楚需求申请、提交审批、审批通过/驳回和回到需求创建询价的路径 | `App.tsx`、`scripts/stage-seven-demand-approval-demo-ui.test.ts` |
| 4 | 询价项目与报价对比演示体验第一轮 | 第4轮补询价项目和报价对比的可见演示体验：询价项目页新增“询价协同演示台”，报价对比页新增“比价定标演示台”，让演示者能直接讲清楚邀请供应商、报价比较、推荐定标、提交定标审批和生成订单后的只读边界 | `App.tsx`、`scripts/stage-seven-rfq-quote-demo-ui.test.ts` |
| 5 | 采购订单、收货验收与发票付款演示体验第一轮 | 第5轮补采购履约后半段的可见演示体验：采购订单页新增“订单履约演示台”，收货验收页新增“收货验收演示台”，发票付款页新增“发票付款演示台”，让演示者能直接讲清楚订单确认、供应商发货、收货验收、开票对账、差异处理和付款状态闭环 | `App.tsx`、`scripts/stage-seven-fulfillment-demo-ui.test.ts` |
| 6 | 采购方 7 页演示走查和视觉收敛第一轮 | 第6轮补采购方主流程 7 页统一走查入口：在采购需求、审批中心、询价项目、报价对比、采购订单、收货验收、发票付款页面统一展示“采购方主流程演示路径”，标记当前演示页、下一演示页和 7 页顺序跳转，减少演示时找入口的问题 | `App.tsx`、`scripts/stage-seven-buyer-walkthrough-polish-ui.test.ts` |
| 7 | 采购方 7 页真实浏览器走查第一轮 | 第7轮使用真实浏览器在 Mock 模式执行采购方 7 页桌面与移动走查：7 页均显示主流程演示路径和对应演示台，桌面 `desktop-1280x720` 与移动 `mobile-390x844` 均无整页横向溢出、无浏览器控制台 error，并修复审批中心缺少顺序下一步按钮的问题 | `docs/stage-seven-browser-walkthrough-result.md`、`scripts/stage-seven-browser-walkthrough-result.test.ts` |
| 8 | Java 模式演示数据瘦身第一轮 | 第8轮在前端展示层为采购方主流程列表增加演示展示上限：统计和筛选仍保留全量结果，但采购需求、询价项目、报价对比、采购订单、收货验收和发票付款列表默认只渲染前 20 条，避免 Java 本地联调数据持续追加导致首屏变慢 | `App.tsx`、`scripts/stage-seven-java-demo-data-slimming-ui.test.ts` |
| 9 | Java 模式真实浏览器复跑第一轮 | 第9轮使用 in-app browser 在 Java 数据源下复跑采购方 7 页桌面与移动验收：14 个页面 / 视口组合失败项为 0，均识别 Java 数据源和采购方主流程演示路径，无加载失败、无 `argument type mismatch`、无 React runtime error、无整页横向溢出、浏览器控制台 error 为 0；截图接口在当前浏览器会话超时，本轮以 JSON 指标作为证据 | `docs/artifacts/stage-seven-java-browser-recheck-result.json`、`scripts/stage-seven-java-browser-recheck-result.test.ts` |
| 10 | Java 模式顺序按钮点击路径复核第一轮 | 第10轮在 Java 数据源下实际点击采购方主流程 7 个顺序按钮：从采购需求的“打开审批中心处理待办”开始，连续进入审批中心、询价项目、报价对比、采购订单、收货验收、发票付款，并通过“主流程演示闭环”回到首页看板；7 个按钮均唯一且可点击，点击后目标页面均识别成功，失败项为 0 | `docs/artifacts/stage-seven-java-sequence-click-result.json`、`scripts/stage-seven-java-sequence-click-result.test.ts` |
| 11 | 采购方演示态细节收敛第一轮 | 第11轮在采购方 7 页主流程增加统一演示者提示：每页展示“演示态细节收敛”，明确讲解视线、默认选中记录、列表展示数量、主按钮优先和下一页衔接，减少现场演示时反复找记录、找按钮和解释展示上限的问题 | `App.tsx`、`scripts/stage-seven-demo-presentation-polish-ui.test.ts` |
| 12 | 采购方关键操作可用性提示第一轮 | 第12轮基于 Java 浏览器复核结果，为采购方主流程页补充“关键操作可用性”提示：提交审批、通过、创建询价、定标审批、生成采购订单、登记收货、登记付款即使当前数据不可直接操作，也会在同一视线内显示动作、可演示状态和边界原因，减少演示时找不到按钮的误判 | `App.tsx`、`docs/artifacts/stage-seven-buyer-key-action-usability-result.json`、`scripts/stage-seven-key-action-readiness-ui.test.ts` |
| 13 | 采购方关键操作定位第一轮 | 第13轮把“关键操作可用性”面板从静态提示改成演示定位器：可用动作显示“定位真实操作区”，点击后给出已定位反馈并滚动到当前页主业务操作区；不可用动作仍禁用并保留边界说明，避免演示时出现可点击但无反馈的假按钮 | `App.tsx`、`docs/artifacts/stage-seven-buyer-key-action-focus-result.json`、`scripts/stage-seven-key-action-readiness-ui.test.ts` |
| 14 | Java 主流程真实点击演示复核第一轮 | 第14轮在 Java 数据源下复核采购方 7 个真实业务动作：提交审批、通过审批、创建询价、定标审批、生成订单、登记收货、登记付款。当前数据下登记付款能真实点击并出现业务反馈，其余动作均有可解释边界，未出现 React runtime error、横向溢出或控制台错误 | `docs/artifacts/stage-seven-java-real-action-click-result.json`、`scripts/stage-seven-real-action-click-result.test.ts` |
| 15 | Java 主流程真实点击断点修复第一轮 | 第15轮补充本地 Java 演示 fixture，专门覆盖提交审批、通过审批、创建询价、定标审批、生成订单和登记收货 6 个真实点击断点：为每个断点准备独立的 `stage7` 状态样本，避免已有演示数据全部处在已完成或只读状态 | `backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql`、`scripts/stage-seven-real-action-demo-seed.test.ts` |
| 16 | Java 主流程真实点击二次复核 | 第16轮把真实点击复核沉淀为可重复 Chrome CDP 脚本，并给关键操作按钮补稳定测试标识；复核结果为提交审批、通过审批、创建询价、定标审批、生成采购订单、登记收货 6 个动作均真实点击成功，登记付款保持当前阶段边界可解释，失败项为 0 | `scripts/stage-seven-real-action-click-check.mjs`、`docs/artifacts/stage-seven-java-real-action-click-result.json`、`scripts/stage-seven-real-action-click-result.test.ts` |
| 17 | Java 主流程付款登记真实点击补齐 | 第17轮补齐付款登记可重复演示数据：在 stage7 fixture 中为已发货/待收货样本预置待付款发票，收货动作完成后进入发票付款页可直接登记付款；复核结果为提交审批、通过审批、创建询价、定标审批、生成采购订单、登记收货、登记付款 7 个采购方主流程动作均真实点击成功，失败项为 0 | `backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql`、`scripts/stage-seven-real-action-click-check.mjs`、`docs/artifacts/stage-seven-java-real-action-click-result.json` |
| 18 | 采购方完整现场演示脚本 | 第18轮整理采购方现场演示 runbook，把阶段七 7 个真实点击动作串成从需求申请到付款登记的讲解顺序，明确准备动作、开场话术、逐页点击、成功反馈、异常兜底和验收口径，避免现场演示只会点按钮但讲不清业务闭环 | `docs/stage-seven-buyer-demo-runbook.md`、`scripts/stage-seven-demo-runbook.test.ts` |
| 19 | 供应商侧协同演示脚本第一轮 | 第19轮进入供应商侧协同演示补强，整理供应商侧现场演示 runbook，把供应商收到询价、提交报价、查看报价记录、确认订单、提交发货、提交发票和发票应收串成与采购方闭环相互呼应的演示路径，并明确当前只是脚本第一轮，不声明供应商侧 5 个动作已经全部可重复真实点击 | `docs/stage-seven-supplier-demo-runbook.md`、`scripts/stage-seven-supplier-demo-runbook.test.ts` |
| 20 | 供应商侧真实点击 fixture 与脚本 | 第20轮补齐供应商侧真实点击 fixture 与脚本：为提交报价、确认订单、提交发货、提交发票、应收对账备注 5 个动作准备独立 Java 演示样本，给现有真实按钮补稳定测试标识，并沉淀 Chrome CDP 复核脚本与 JSON 结果 | `backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql`、`scripts/stage-seven-supplier-real-action-click-check.mjs`、`docs/artifacts/stage-seven-supplier-java-real-action-click-result.json` |
| 21 | 采购方与供应商现场演示验收包 | 第21轮把采购方 7 个动作与供应商 5 个动作合计 12 个真实点击动作整合为一份现场演示验收包：一条命令顺序执行两条 Chrome CDP 脚本，生成联合 JSON 结果，并整理演示前准备、现场讲解顺序、失败兜底和不声明范围 | `scripts/stage-seven-onsite-demo-acceptance-check.mjs`、`docs/artifacts/stage-seven-onsite-demo-acceptance-result.json`、`docs/stage-seven-onsite-demo-acceptance-package.md` |
| 22 | 阶段七现场视觉验收包 | 第22轮补采购方和供应商演示入口的桌面/移动截图、控制台错误和整页横向溢出检查：覆盖采购方采购需求入口和供应商询价邀请入口，在 Java 数据源下生成 4 组截图、JSON 指标和 Markdown 结果 | `scripts/stage-seven-onsite-visual-acceptance-check.mjs`、`docs/artifacts/stage-seven-onsite-visual-acceptance-result.json`、`docs/stage-seven-onsite-visual-acceptance-result.md` |
| 23 | 平台运营端轻量演示路径 | 第23轮补平台运营端 4 页统一演示路径：平台看板、租户列表、企业审核和平台公告可以按顺序跳转，并在同一视线内展示当前演示页、下一演示页和平台运营边界 | `App.tsx`、`scripts/stage-seven-platform-demo-path-ui.test.ts` |
| 24 | 平台运营端现场演示脚本 | 第24轮整理平台运营端现场演示 runbook，把平台看板、租户列表、企业审核和平台公告串成可讲解顺序，并明确平台方提供 SaaS 运营底座、不直接参与采购业务决策的边界 | `docs/stage-seven-platform-demo-runbook.md`、`scripts/stage-seven-platform-demo-runbook.test.ts` |
| 25 | 平台运营端 Java 视觉验收 | 第25轮补平台运营端 Java 模式轻量视觉验收：覆盖平台看板、租户列表、企业审核和平台公告 4 页桌面截图、DOM 关键文案和页面错误文本检查，生成 JSON 与 Markdown 结果 | `scripts/stage-seven-platform-visual-acceptance-check.mjs`、`docs/artifacts/stage-seven-platform-visual-acceptance-result.json`、`docs/stage-seven-platform-visual-acceptance-result.md` |
| 26 | 平台运营端真实点击复核 | 第26轮补平台运营端 Java 模式真实点击复核：准备独立 stage7 平台 fixture，覆盖停用租户、升级专业版、通过企业审核、发布平台公告和撤回平台公告 5 个动作，并生成 JSON 结果 | `backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql`、`scripts/stage-seven-platform-real-action-click-check.mjs`、`docs/artifacts/stage-seven-platform-java-real-action-click-result.json` |
| 27 | 三端现场演示总验收包 | 第27轮把现场演示验收包从采购方与供应商扩展为三端总包：一条命令顺序执行采购方 7 个、供应商 5 个、平台端 5 个真实点击动作，生成 17 个动作的联合 JSON 结果，并同步总 runbook 的讲解顺序和不声明范围 | `scripts/stage-seven-onsite-demo-acceptance-check.mjs`、`docs/artifacts/stage-seven-onsite-demo-acceptance-result.json`、`docs/stage-seven-onsite-demo-acceptance-package.md`、`scripts/stage-seven-three-role-demo-acceptance-package.test.ts` |
| 28 | 阶段七产品可演示收口验收矩阵 | 第28轮把阶段七从执行流水账收口为产品验收矩阵，明确“已可演示 / 仍是演示口径 / 下一阶段生产化入口”，并把阶段八建议入口聚焦到演示链路产品化、组件抽取、权限与审计增强 | `docs/stage-seven-closeout-acceptance-matrix.md`、`scripts/stage-seven-closeout-acceptance-matrix.test.ts` |

## 待补强

- 阶段八建议入口：三端现场演示总验收包和阶段七收口矩阵已完成，下一轮建议进入演示链路产品化加固，优先处理 17 个真实动作背后的页面反馈、失败提示、空状态、只读边界和移动端体验。
- 供应商侧真实点击 fixture 与脚本：已补脚本和样本，后续可继续把供应商侧截图、移动端视觉和讲解话术纳入同一验收包。
- Java 模式真实页面：视觉脚本仅作为辅助验收，重点转为页面可见改进、按钮禁用态、空状态、移动端横向溢出和错误反馈。
- 主流程演示路径：继续把需求申请、审批、创建询价、供应商报价、定标、生成订单、收货、发票付款整理成可重复演示路径。
- 表单和详情抽取：在真实页面问题稳定后，再从 `App.tsx` 抽取高频表单、详情面板和操作反馈组件。

## 暂不做

- 不进入商城、竞价、招标、AI 或真实支付。
- 暂停扩展新模块，直到采购方主流程 7 页达到可演示效果。
- 不新增路由库，继续沿用当前 `activeRole` / `activeModule` 状态切换。
- 不把视觉验收脚本通过误写成完整业务闭环已全部完成。
