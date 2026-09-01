# 鲁东大学 POC AI 辅助审批

## 能力边界

AI 只提供规则校验、风险线索和辅助研判，不自动通过、驳回或签字。页面中的置信度表示当前材料对分析的支撑程度，不表示结论正确率，不得宣传“100% 准确”。

## 正式模型配置

后端通过 OpenAI 兼容的 `chat/completions` 接口调用正式大模型：

```bash
export LUDONG_AI_REVIEW_ENDPOINT='https://model-gateway.example.edu/v1/chat/completions'
export LUDONG_AI_REVIEW_API_KEY='由密钥管理系统注入'
export LUDONG_AI_REVIEW_MODEL='学校批准使用的模型标识'
```

- 配置成功时返回 `analysisMode=AI_MODEL`。
- 未配置时返回 `analysisMode=RULE_ASSISTED`。
- 模型调用失败时返回 `analysisMode=RULE_FALLBACK`，审批业务仍可办理。
- API 密钥不得写入代码、数据库、日志或前端构建产物。

## 制度知识

制度条款位于：

`backend-java/src/main/resources/ludong-poc/knowledge/approval-policy-v1.json`

当前版本收录两份学校表格中可核验的校领导审批金额条件、预算审查选项、商城选型要求和归档要求。附件三具体品目限价原文尚未随项目资料提供，系统不会虚构限价；待学校提供正式文件后，应新增知识版本并经过业务负责人复核后发布。

每条结论必须关联以下证据：

- `FIELD`：项目表单或设备明细具体字段。
- `RULE`：版本化制度条款及来源。
- `PRIOR_APPROVAL`：系统记录的前序审批人、意见和时间；首节点可以为空。

正式模型只能引用服务端提供的 `findingId` 和证据，不接受模型自行生成的制度条款。

## 质量评测

固定样本位于：

`backend-java/src/main/resources/ludong-poc/knowledge/ai-evaluation-samples-v1.json`

指标接口：`GET /api/v1/buyer/ludong-poc/ai-review/metrics`

当前统计口径：

- 风险召回率：固定样本中预期风险被识别的比例。
- 风险精确率：识别出的风险中命中预期风险的比例。
- 误报数量：固定样本中未被标注但被识别为风险的数量。
- 人工采纳率：审批人反馈中标记为“采纳”的比例。

固定样本指标只能说明已定义场景的回归表现，不能外推为全部采购业务准确率。样本应持续增加真实脱敏案例，并由采购、资产、财务和信息化部门共同确认标签。
