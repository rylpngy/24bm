# 阶段十执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 合同管理承接订单计划 | 第1轮进入阶段十，把阶段九决策表里的推荐路径落到合同管理承接订单；本轮确认阶段十不是从零开发合同系统，而是复用阶段五合同管理能力，围绕订单生成合同、合同审批、合同履约事件、合同与订单/发票/付款关系形成下一轮可演示路径 | `docs/stage-ten-contract-order-handoff-plan.md`、`scripts/stage-ten-contract-order-handoff-plan.test.ts` |
| 2 | 合同演示路径复核 | 第2轮补阶段十合同演示路径复核，覆盖采购订单、合同管理、审批中心、收货验收和发票付款；以 Java 数据源和桌面/移动截图确认订单生成合同、合同审批、合同履约事件、合同与订单/发票/付款关系可讲通 | `scripts/stage-ten-contract-demo-path-check.mjs`、`docs/stage-ten-contract-demo-path-review.md`、`docs/artifacts/stage-ten-contract-demo-path-result.json`、`scripts/stage-ten-contract-demo-path-review.test.ts` |
| 3 | 合同演示总线和推荐样本 | 第3轮在合同管理页补阶段十合同演示总线、合同演示准备检查和推荐合同样本高亮；合同页可围绕订单生成合同、合同审批、合同履约事件、合同与订单/发票/付款关系进行集中讲解 | `stage10-contract-demo-command-center`、`stage10-contract-demo-readiness`、`stage10-demo-sample-contract`、`scripts/stage-ten-contract-demo-command-center-ui.test.ts` |
| 4 | 合同演示动作闭环 | 第4轮在合同详情页补合同演示动作闭环，把提交合同审批、推进履约、处理收货验收、处理发票付款和归档合同集中成推荐动作链；每个动作展示真实动作按钮、动作反馈和下一步承接，仍复用既有 Java API 与页面跳转，不新增合同工作流接口 | `stage10-contract-demo-action-loop`、`scripts/stage-ten-contract-demo-action-loop-ui.test.ts` |
| 5 | 合同现场讲解脚本和 Java 视觉复跑 | 第5轮补合同专项现场讲解稿，并复用 Java 视觉复跑确认阶段十合同页新增演示总线、推荐样本和动作闭环；讲解稿覆盖演示前检查、五页演示顺序、合同页三件重点、暂不声明边界和异常兜底 | `docs/stage-ten-contract-presenter-runbook.md`、`docs/artifacts/stage-ten-contract-demo-path-result.json`、`scripts/stage-ten-contract-presenter-runbook.test.ts` |
| 6 | 阶段十合同演示收口复盘 | 第6轮基于计划、路径复核、讲解稿、Java 视觉复跑和三端真实动作验收，确认阶段十合同承接订单已达到产品演示阶段目标；合同法务深化暂缓，下一步建议先回到采购主流程 polish | `docs/stage-ten-contract-closeout-review.md`、`scripts/stage-ten-contract-closeout-review.test.ts` |

## 待补强

- 下一轮建议：回到采购主流程 polish，优先优化采购需求、询价项目、报价对比、采购订单、收货验收和发票付款的页面一致性、演示提示、按钮状态和空/只读边界。
- 合同法务深化暂缓，除非用户明确要求电子签章、合同模板、条款审批或外部合同系统集成。
- 合同附件、电子签章、外部合同系统、法务红线和合同版本对比继续暂缓。

## 暂不做

- 不做电子签章、真实盖章流、法务红线批注或合同版本对比。
- 不接外部合同系统、ERP、OA 或财务系统深度集成。
- 不并行启动商城直采、竞价采购、招标或 AI。
- 不把合同台账、合同审批和履约事件误写成完整法务合同生命周期系统。
