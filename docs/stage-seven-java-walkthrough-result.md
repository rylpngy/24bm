# 阶段七 Java 模式采购主流程演示闭环结果

## 验收目标

阶段七第一轮聚焦 Java 模式真实演示闭环：在本地 Java 后端和前端服务下，覆盖采购需求、审批中心、询价项目、报价对比、采购订单、收货验收、发票付款 7 个采购方核心页面，检查页面是否能稳定渲染、是否识别 Java 数据源、是否出现加载失败或运行时错误。

## 覆盖页面

| 页面 | 桌面 1280x720 | 移动 390x844 | DOM 验收 |
| --- | --- | --- | --- |
| 采购需求 | `docs/artifacts/stage-seven-java-demands-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-demands-mobile-390x844.png` | 识别 `Java 数据源`、`采购需求`、`提交审批`、`创建询价` |
| 审批中心 | `docs/artifacts/stage-seven-java-approvals-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-approvals-mobile-390x844.png` | 识别 `Java 数据源`、`审批中心`、`待审批`、`通过` |
| 询价项目 | `docs/artifacts/stage-seven-java-rfqs-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-rfqs-mobile-390x844.png` | 识别 `Java 数据源`、`询价项目`、`邀请供应商`、`报价` |
| 报价对比 | `docs/artifacts/stage-seven-java-quotes-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-quotes-mobile-390x844.png` | 识别 `Java 数据源`、`报价对比`、`报价比较矩阵`、`定标` |
| 采购订单 | `docs/artifacts/stage-seven-java-orders-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-orders-mobile-390x844.png` | 识别 `Java 数据源`、`采购订单`、`履约`、`供应商` |
| 收货验收 | `docs/artifacts/stage-seven-java-receipts-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-receipts-mobile-390x844.png` | 识别 `Java 数据源`、`收货验收`、`登记收货`、`验收` |
| 发票付款 | `docs/artifacts/stage-seven-java-invoices-desktop-1280x720.png` | `docs/artifacts/stage-seven-java-invoices-mobile-390x844.png` | 识别 `Java 数据源`、`发票付款`、`付款`、`三单匹配` |

## 失败信号

- 无加载失败。
- 无 `Failed to fetch`。
- 无 `argument type mismatch`。
- 无 React runtime error。
- 视觉检查结果文件：`docs/artifacts/stage-seven-java-walkthrough-result.json`。

## 执行命令

- `node scripts/stage-seven-java-walkthrough.mjs`
- `npm test -- scripts/stage-seven-java-walkthrough.test.ts`

## 边界

- 本轮目标是建立 Java 模式真实页面验收脚本和固定演示路径，不代表采购主流程所有业务写入细节已经全部完成。
- 如果脚本发现缺失文案、按钮禁用态、空状态、移动端横向溢出或错误反馈问题，下一轮优先做页面细节修复。
- 本轮不进入商城、竞价、招标、AI、真实支付或 ERP/OA/财务系统集成。
