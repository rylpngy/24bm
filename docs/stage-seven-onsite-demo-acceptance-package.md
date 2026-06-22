# 阶段七现场演示验收包

## 验收目标

本验收包用于现场演示前快速确认 Java 模式主流程可演示。它把采购方 7 个真实点击动作、供应商 5 个真实点击动作和平台端 5 个真实点击动作合并成一套一键验收结果，三端合计 `17` 个真实点击动作，避免现场只依赖口头说明或手工点到一半才发现样本状态不对。

验收结论只覆盖阶段七演示范围：采购方询价比价闭环、供应商协同履约链路和平台运营轻量治理路径。当前不声明真实支付、电子签章、ERP 深度集成已经完成。

## 一键验收命令

```bash
node scripts/stage-seven-onsite-demo-acceptance-check.mjs
```

这条命令会顺序执行：

- `node scripts/stage-seven-real-action-click-check.mjs`
- `node scripts/stage-seven-supplier-real-action-click-check.mjs`
- `node scripts/stage-seven-platform-real-action-click-check.mjs`

三个脚本都会使用 `V120__stage_seven_real_action_demo_seed.sql` 复位 Java 本地演示数据，并通过 Chrome CDP 在 `http://127.0.0.1:3000` 执行真实点击。

## 验收产物

- 联合结果：`docs/artifacts/stage-seven-onsite-demo-acceptance-result.json`
- 采购方结果：`docs/artifacts/stage-seven-java-real-action-click-result.json`
- 供应商结果：`docs/artifacts/stage-seven-supplier-java-real-action-click-result.json`
- 平台端结果：`docs/artifacts/stage-seven-platform-java-real-action-click-result.json`
- 采购方讲解脚本：`docs/stage-seven-buyer-demo-runbook.md`
- 供应商讲解脚本：`docs/stage-seven-supplier-demo-runbook.md`
- 平台端讲解脚本：`docs/stage-seven-platform-demo-runbook.md`

通过标准：

- 联合结果 `totalActions` 为 `17`。
- 联合结果 `failedTotal` 为 `0`。
- 采购方 `actionCount` 为 `7`，`failedCount` 为 `0`。
- 供应商 `actionCount` 为 `5`，`failedCount` 为 `0`。
- 平台端 `actionCount` 为 `5`，`failedCount` 为 `0`。
- 页面加载过程中不出现“加载失败”、`argument type mismatch` 或接口 4xx/5xx 错误。

## 现场讲解顺序

| 顺序 | 角色 | 页面 | 动作 | 讲解重点 |
| --- | --- | --- | --- | --- |
| 1 | 采购方 | 采购需求 | 提交审批 | 采购从内部需求和预算约束开始。 |
| 2 | 采购方 | 审批中心 | 通过审批 | 审批通过后需求才可进入询价。 |
| 3 | 采购方 | 采购需求 | 创建询价 | 已通过需求邀请供应商形成 RFQ。 |
| 4 | 供应商 | 询价邀请 | 提交报价 | 供应商只响应自己的邀请，看不到采购方预算和其他供应商报价。 |
| 5 | 采购方 | 报价对比 | 提交定标审批 | 比价后仍需定标审批，体现合规边界。 |
| 6 | 采购方 | 报价对比 | 生成采购订单 | 定标审批通过后生成采购订单。 |
| 7 | 供应商 | 销售订单 | 确认订单 | 供应商确认采购方订单，进入履约。 |
| 8 | 供应商 | 销售订单 | 提交发货 | 供应商登记物流，采购方才能收货验收。 |
| 9 | 采购方 | 收货验收 | 登记收货 | 采购方确认收货结果，为发票付款做准备。 |
| 10 | 供应商 | 销售订单 | 提交发票 | 收货后供应商提交发票形成应收。 |
| 11 | 供应商 | 发票应收 | 保存对账备注 | 供应商维护应收对账口径，付款状态由采购方驱动。 |
| 12 | 采购方 | 发票付款 | 登记付款 | 采购方登记付款状态，当前不触发真实资金流。 |
| 13 | 平台端 | 租户列表 | 停用租户 | 平台方能维护 SaaS 租户状态，但不处理采购业务单据。 |
| 14 | 平台端 | 租户列表 | 升级专业版 | 套餐和容量属于平台运营治理能力。 |
| 15 | 平台端 | 企业审核 | 通过企业审核 | 平台做企业准入，不代表采购方已建立私域合作关系。 |
| 16 | 平台端 | 平台公告 | 发布平台公告 | 公告用于运营通知和站内触达。 |
| 17 | 平台端 | 平台公告 | 撤回平台公告 | 公告生命周期留痕，不改采购业务状态。 |

## 入口地址

- 采购方入口：`http://localhost:3000/?role=buyer&module=demands`
- 供应商入口：`http://localhost:3000/?role=supplier&module=opportunities`
- 平台端入口：`http://localhost:3000/?role=platform&module=overview`
- 后端健康检查：`http://localhost:8080/api/v1/health`

页面顶部应显示 `Java 数据源`。

## 失败兜底

如果联合验收失败，先看 `docs/artifacts/stage-seven-onsite-demo-acceptance-result.json` 的 `failed` 字段。

- 如果采购方动作失败，单独执行 `node scripts/stage-seven-real-action-click-check.mjs`。
- 如果供应商动作失败，单独执行 `node scripts/stage-seven-supplier-real-action-click-check.mjs`。
- 如果平台端动作失败，单独执行 `node scripts/stage-seven-platform-real-action-click-check.mjs`。
- 如果 seed 执行失败，检查 Docker Postgres 容器 `procurement-saas-postgres` 是否运行。
- 如果页面加载失败，检查 `curl -I http://localhost:3000/` 和 `curl http://localhost:8080/api/v1/health`。
- 如果按钮不可见，先确认页面顶部为 `Java 数据源`，再重新执行联合验收命令复位样本。

## 不声明范围

阶段七现场演示验收包不声明以下能力已经完成：

- 真实支付、税控开票、电子签章。
- ERP、OA、财务系统深度集成。
- 商城直采、竞价采购、复杂招标、专家评审。
- AI 推荐、智能审批、支出分析和高级 BI。
- 生产级权限矩阵、计费套餐、开放 API 和 Webhook。
- 不声明平台套餐计费、用量统计、公共供应商市场已经完成。

## 收口话术

这套验收包证明当前系统已经具备可演示的 Java 三端业务骨架：采购方能完成从需求到付款登记的 7 个关键动作，供应商能完成从报价到应收对账的 5 个关键动作，平台端能完成租户治理、企业审核和公告生命周期 5 个关键动作。后续研发可以在这个可演示底座上继续补合同深化、财务深化、平台运营和生产级治理能力。
