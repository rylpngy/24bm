# 阶段十一采购方主流程视觉密度验收

生成时间：2026-06-21T13:35:40.496Z

## 验收命令

`node scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs`

## 结论

- 数据源：Java 数据源
- 覆盖页面：7 个采购方主流程页面。
- 覆盖视口：desktop-1280x720、mobile-390x844。
- 检查组合：14 个页面/视口组合。
- 失败项：0
- 阶段十一操作条可见，首屏业务焦点可见，动作区可见性可见，演示数据瘦身可见，无整页横向溢出，控制台 error 为 0。

## 截图证据

| 页面 | 视口 | 截图 | 结果 |
| --- | --- | --- | --- |
| 采购需求 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-demands-desktop-1280x720.png` | 通过 |
| 采购需求 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-demands-mobile-390x844.png` | 通过 |
| 审批中心 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-approvals-desktop-1280x720.png` | 通过 |
| 审批中心 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-approvals-mobile-390x844.png` | 通过 |
| 询价项目 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-rfqs-desktop-1280x720.png` | 通过 |
| 询价项目 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-rfqs-mobile-390x844.png` | 通过 |
| 报价对比 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-quotes-desktop-1280x720.png` | 通过 |
| 报价对比 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-quotes-mobile-390x844.png` | 通过 |
| 采购订单 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-orders-desktop-1280x720.png` | 通过 |
| 采购订单 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-orders-mobile-390x844.png` | 通过 |
| 收货验收 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-receipts-desktop-1280x720.png` | 通过 |
| 收货验收 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-receipts-mobile-390x844.png` | 通过 |
| 发票付款 | desktop-1280x720 | `docs/artifacts/stage-eleven-buyer-main-flow-invoices-desktop-1280x720.png` | 通过 |
| 发票付款 | mobile-390x844 | `docs/artifacts/stage-eleven-buyer-main-flow-invoices-mobile-390x844.png` | 通过 |

## 检查项

- Java 数据源可见。
- 阶段十一操作条可见。
- 首屏业务焦点可见。
- 动作区可见性可见。
- 演示数据瘦身可见。
- 页面一致性检查可见。
- 页面无“加载失败”、`argument type mismatch`、React runtime error。
- 控制台 error 为 0。
- 无整页横向溢出。
