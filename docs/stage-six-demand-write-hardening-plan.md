# 阶段六采购需求写入补强计划

## 目标

采购需求是阶段六第一实施泳道。当前系统已经具备采购需求创建、编辑、提交审批和审批回写的 Java 基础能力，本轮目标不是重写需求模块，而是把这些能力整理成可验收、可复用、可迁移到 RFQ 和订单的写入样板。

本计划只做验收设计和实施边界，不新增业务代码。下一轮再按本计划补测试或最小边界。

## 现有 Java 写入入口

| 能力 | Java 入口 | 前端 client | 当前服务端边界 |
| --- | --- | --- | --- |
| 采购需求创建 | `POST /api/v1/buyer/demands` | `createBuyerDemand(payload)` | 校验租户、用户、有效部门和明细行，创建草稿并写入 `purchase_demand.created` 审计 |
| 采购需求编辑 | `PUT /api/v1/buyer/demands/{demandId}` | `updateBuyerDemand(demandId, payload)` | 仅草稿可编辑；服务端错误文案包含 `Only draft purchase demand can be updated` |
| 提交审批 | `POST /api/v1/buyer/demands/{demandId}/submit` | `submitBuyerDemand(demandId)` | 通过状态转换校验后进入审批中，并创建采购需求审批任务 |
| 审批回写 | `POST /api/v1/buyer/demands/{demandId}/approval` | `reviewBuyerDemandApproval(demandId, approved)` | 仅审批中可审批；审批通过进入已通过，驳回进入已驳回，并写入审计和通知 |

## 写入路径验收矩阵

| 路径 | 正向验收 | 反向/边界验收 | 下一步判断 |
| --- | --- | --- | --- |
| 采购需求创建 | 草稿创建后列表和详情刷新回显，预算、部门和明细行一致 | 缺少部门、预算或明细行时应由表单或 Java 校验阻断 | 已有基础能力，下一轮补端到端测试证据 |
| 采购需求编辑 | 草稿编辑后刷新回显标题、预算、部门和明细行 | 非草稿编辑应被服务端拒绝，并映射为可理解反馈 | 需要补审批中禁改 UI/测试 |
| 提交审批 | 草稿提交后生成审批任务，需求状态进入审批中 | 重复提交、非草稿提交应阻断 | 需要补重复提交反例测试 |
| 审批通过 | 审批中心通过后需求状态进入已通过，最近审批可回看 | 非审批中需求不允许审批 | 已通过后应开放创建 RFQ 入口 |
| 审批驳回 | 审批中心驳回后需求状态进入已驳回，最近审批可回看 | 驳回后是否允许重新编辑/重新提交需要产品边界确认 | 暂按服务端现状记录，不在第3轮扩状态 |
| 审批中禁改 | 审批中需求编辑应禁用或提交后展示服务端拒绝 | 必须保留 `Only draft purchase demand can be updated` 这类服务端硬边界 | 第3轮优先补 UI 禁用和错误反馈测试 |
| 已通过创建 RFQ | 已通过需求可进入创建 RFQ，供应商和截止时间满足校验后创建 RFQ | 未通过需求、已创建 RFQ 的重复创建、截止时间不合法应阻断 | 第4轮再进入 RFQ 状态机 |

## 页面补强要求

采购需求页面下一轮应优先补以下体验一致性：

- 创建、编辑、提交审批、审批回写后统一刷新采购方 Java 数据。
- 表单忙碌态、禁用态和错误反馈保持同一种语言。
- 审批中禁改要在页面上明确呈现，而不是只依赖用户点按钮后收到错误。
- 已通过创建 RFQ 要把供应商、截止日期和重复创建风险展示清楚。
- 审批驳回后的重新编辑/重新提交暂不扩展，先记录为待产品确认边界。

## Java 补强要求

采购需求 Java 侧下一轮优先补验证，不急着新增表：

- 补创建、编辑、提交审批、审批通过、审批驳回的组合测试。
- 补非草稿编辑失败测试，明确 `Only draft purchase demand can be updated` 是硬边界。
- 补重复提交或非草稿提交失败测试。
- 补审批任务缺失或非审批中审批失败测试。
- 保持租户隔离、部门有效性和明细行校验。

## 第3轮建议：采购需求写入验收测试补强

第3轮建议先做测试，不急着改实现：

1. 新增采购需求 Java 状态流转测试，覆盖草稿创建、编辑、提交审批、审批通过、审批驳回和非草稿编辑失败。
2. 新增前端契约测试，确认 `createBuyerDemand`、`updateBuyerDemand`、`submitBuyerDemand`、`reviewBuyerDemandApproval` 和页面操作入口都存在。
3. 新增 UI 边界测试，确认审批中需求显示禁改提示，已通过需求显示创建 RFQ 准备提示。
4. 如果测试暴露缺口，再补最小前端禁用态或 Java 状态校验。

## 暂不进入

- 不在本轮改 RFQ、订单、收货、发票付款或合同。
- 不新增审批流配置、多级审批或审批意见持久化。
- 不改变审批驳回后的产品规则，先记录边界。
- 不进入商城、竞价、招标、AI 或真实支付。

## 验收命令

建议把以下命令作为阶段六第2轮验收基线：

- `npm test -- scripts/stage-six-demand-write-hardening-plan.test.ts`
- `npm test -- scripts/stage-six-write-capability-matrix.test.ts scripts/stage-six-demand-write-hardening-plan.test.ts`
- `npm run build`
- `npm test`
- `git diff --check`
