# 阶段十三执行清单

## 已完成

| 序号 | 项目 | 当前结果 | 验收 |
| --- | --- | --- | --- |
| 1 | 合同深化可演示切片计划 | 第1轮基于阶段十二客户演示问题清单和阶段十合同收口证据，明确阶段十三选择合同深化，但不从零重做合同系统；第一轮聚焦合同总览、合同审批、履约事件、订单/收货/发票/付款关系、归档门禁、演示操作条和推荐合同样本 | `docs/stage-thirteen-contract-deepening-plan.md`、`scripts/stage-thirteen-contract-deepening-plan.test.ts` |
| 2 | 合同深化第一轮 UI 和真实动作复验 | 合同管理页新增 `stage13-contract-demo-readiness` 首屏验收面板，把合同总览、合同审批、履约事件、订单/收货/发票/付款关系、归档门禁、演示操作条和推荐合同样本统一成客户演示口径；真实动作继续复用阶段十合同审批、履约推进、收货验收、发票付款和归档合同按钮 | `docs/stage-thirteen-contract-ui-real-action-result.md`、`scripts/stage-thirteen-contract-ui-real-action-readiness.test.ts` |
| 3 | 合同深化浏览器视觉验收 | 使用 Java 数据源对合同管理页完成桌面 `1280x720` 和移动 `390x844` 复跑；`stage13-contract-demo-readiness`、`stage10-contract-demo-action-loop`、推荐合同样本均可见，失败项为 0，控制台 error 为 0，无整页横向溢出 | `docs/stage-thirteen-contract-visual-acceptance-result.md`、`docs/artifacts/stage-thirteen-contract-visual-acceptance-result.json`、`scripts/stage-thirteen-contract-visual-acceptance-check.mjs`、`scripts/stage-thirteen-contract-visual-acceptance.test.ts` |
| 4 | 合同深化现场讲解脚本 | 已把合同总览、提交合同审批、推进履约、处理收货验收、处理发票付款和归档合同整理成 5 分钟客户演示话术，并补充客户提问兜底和暂不声明边界 | `docs/stage-thirteen-contract-presenter-runbook.md`、`scripts/stage-thirteen-contract-presenter-runbook.test.ts` |

## 待补强

- 下一轮建议：阶段十三合同深化收口复盘，对照计划、UI 复验、视觉验收和讲解脚本判断本阶段是否可收口。
- 若下一轮触碰 Java 合同接口或数据库，必须运行 `mvn -q test`。
- 若客户反馈出现演示阻断，应先修复阻断，再继续合同深化。

## 暂不做

- 不做电子签章、真实盖章、印章管理。
- 不做法务红线批注、合同版本对比和条款结构化审查。
- 不做外部合同系统、签章平台、对象存储和法务审批系统集成。
- 不做真实支付、税控开票、银企直连。
- 不并行启动财务深化、商城直采、竞价采购、平台生态或生产级治理。
