# 阶段七供应商侧协同演示脚本

## 演示目标

本脚本用于把供应商侧协同链路讲清楚：供应商收到采购方询价后，完成提交报价、查看报价记录、确认销售订单、提交发货、提交发票，并在发票应收页跟进回款状态。

本轮为供应商侧演示脚本第一轮，不声明供应商侧 5 个动作已经全部可重复真实点击。当前证据边界是：Java API smoke 已覆盖供应商报价、确认订单、发货和开票接口；采购方侧完整真实点击脚本已在 `docs/stage-seven-buyer-demo-runbook.md` 中固化。下一轮需要补供应商侧真实点击 fixture 与脚本。

补充验收：第20轮已补齐供应商侧真实点击 fixture 与 Chrome CDP 脚本，结果见 `docs/artifacts/stage-seven-supplier-java-real-action-click-result.json`。当前提交报价、确认订单、提交发货、提交发票、保存对账备注 5 个动作均已有 Java 模式真实点击成功证据。

## 演示准备

- 前端地址：`http://localhost:3000/?role=supplier&module=opportunities`
- 后端健康检查：`curl http://localhost:8080/api/v1/health`
- 页面数据源：确认顶部显示 Java 数据源。
- 供应商账号：默认 Java 本地账号 `supplier.sales@example.com`，供应商主体为 `ent-supplier-sunrise`。
- 接口证据：`npm run java:smoke` 已覆盖 `/api/v1/supplier/rfqs`、`/api/v1/supplier/quotes`、`/api/v1/supplier/orders`、`/api/v1/supplier/invoices`。

## 开场话术

供应商端不是另一个采购后台，而是采购方主流程的协同侧。采购方发出询价后，供应商只看到与自己相关的商机、报价、订单和应收，不能看到采购方内部审批、预算，也不能看到其他供应商的报价明细。

## 演示点击

| 顺序 | 页面 | 演示动作 | 成功反馈 | 讲解重点 |
| --- | --- | --- | --- | --- |
| 1 | 询价邀请 | 打开 `http://localhost:3000/?role=supplier&module=opportunities`，查看采购要求、报价截止、需求编号和邀请范围 | 页面显示“询价邀请池”“采购要求”“提交报价”入口 | 供应商从这里接收采购方 RFQ，只处理自己的响应 |
| 2 | 询价邀请 | 在待报价 RFQ 填写金额、税率、交付天数，点击“提交报价” | Java 模式成功后应出现“报价已提交”反馈 | 对应接口 `/api/v1/supplier/rfqs/${rfqId}/quotes` |
| 3 | 报价记录 | 切到“报价记录”，查看已提交报价、交付周期、关联询价状态和报价修改边界 | 页面显示“报价记录池”“跟进定标”“报价详情” | 供应商只能维护自己的报价，定标由采购方处理 |
| 4 | 销售订单 | 切到“销售订单”，对待确认订单点击“确认订单” | Java 模式成功后应出现“供应商订单已确认”反馈 | 对应接口 `/api/v1/supplier/orders/${orderId}/confirm` |
| 5 | 销售订单 | 对待发货订单填写承运商、物流单号，点击“提交发货” | Java 模式成功后应出现“发货信息已提交”反馈 | 对应接口 `/api/v1/supplier/orders/${orderId}/deliveries` |
| 6 | 销售订单 | 对已收货且未开票订单填写发票号、发票金额，点击“提交发票” | Java 模式成功后应出现“发票信息已提交”反馈 | 对应接口 `/api/v1/supplier/orders/${orderId}/invoices` |
| 7 | 发票应收 | 切到“发票应收”，查看发票、应收金额、对账备注、付款状态和回款提醒 | 页面显示“发票应收池”“应收对账单台账” | 付款登记仍由采购方侧驱动，供应商侧只维护应收和对账备注 |

## 接口映射

- 询价邀请列表：`GET /api/v1/supplier/rfqs`
- 提交报价：`POST /api/v1/supplier/rfqs/${rfqId}/quotes`
- 报价记录：`GET /api/v1/supplier/quotes`
- 销售订单：`GET /api/v1/supplier/orders`
- 确认订单：`POST /api/v1/supplier/orders/${orderId}/confirm`
- 提交发货：`POST /api/v1/supplier/orders/${orderId}/deliveries`
- 提交发票：`POST /api/v1/supplier/orders/${orderId}/invoices`
- 发票应收：`GET /api/v1/supplier/invoices`

## 异常兜底

- 如果“提交报价”按钮不可用，说明当前 RFQ 已报价、已截标或已被本地数据用完，先切换询价邀请筛选状态并说明“当前样本已经进入只读边界”。
- 如果“确认订单”不可见，说明订单已经确认或进入后续履约状态，切到销售订单详情讲解状态流转。
- 如果“提交发货”不可见，说明订单尚未确认或已经发货。
- 如果“提交发票”不可见，说明采购方尚未收货或该订单已有发票。
- 如果发票应收没有待回款数据，说明采购方已登记付款或当前样本没有完成开票，切回采购方发票付款 runbook 说明付款状态由采购方侧驱动。

## 验收口径

- 供应商端 6 个菜单可进入：供应商看板、询价邀请、报价记录、销售订单、发票应收、企业档案。
- 演示者可以按“询价邀请 -> 提交报价 -> 报价记录 -> 销售订单 -> 确认订单 -> 提交发货 -> 提交发票 -> 发票应收”讲完整供应商协同链路。
- Java API 层已有接口证据，但本轮只认定为“供应商侧演示脚本第一轮”。
- 下一轮验收必须新增供应商侧真实点击 fixture 与脚本，复核 5 个动作：提交报价、确认订单、提交发货、提交发票、应收对账备注。
