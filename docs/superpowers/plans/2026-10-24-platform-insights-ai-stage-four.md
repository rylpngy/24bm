# 第四阶段实施计划：平台管理、统计与 AI 整合

> 执行采用 subagent-driven-development：完整业务包分工、定向测试、独立审查，主任务统一集成及发布。用户已选择直接执行，不再次讨论已冻结的业务范围。

**Goal:** 管理员能真正配置系统，业务人员可查询导出可信数据，四类 AI 辅助有证据且不代替人工决策。

**Architecture:** 复用现有模块并修复UI/API/权限不一致。新增中立 AI 契约及四个业务适配器、受控编号配置；统一统计查询及导出，不复制学校专用服务，不引入新的管理/BI/审批框架。

**Tech Stack:** React/TypeScript/Vite/TanStack Query、现有 Tailwind/Lucide UI、Java21/Spring/MyBatis、PostgreSQL/Flyway、Flowable、MinIO、Apache POI及现有PDF工具。

**Spec:** `docs/superpowers/specs/2026-10-24-platform-insights-ai-stage-four-design.md`。

## 全局约束

- 基线 `029f88a7beb4d90a8d0729c74091adc414edbb7f`，开发工作区6166，运行原服务固定目录不变。保留 `procurement_saas_base` 与 `24bid-attachments`。
- 所有测试业务写入仅限隔离8095/验收库，严禁把现有e2e默认8080指向原系统运行。
- 使用 apply_patch 修改源码，不删除/还原用户文件，不提交未跟踪客户交付物。
- 不修改历史迁移或种子。V229编号规则归编号任务；V230通用AI证据/反馈/政策归AI任务；其他新迁移需先协调版本。
- API必须有真实权限、租户和行级范围校验；新增控制器更新安全契约测试，mapper继续符合架构隔离测试。
- 业务UI沿用现有风格，常规列表、详情、表单分离，按钮不换行，移动端无整页横溢。无假数据、固定置信度或自动审批。
- Worker不运行共享 `backend-java/target` 下的Maven。需要Java定向红绿测试时使用独立临时构建快照（仅基线加自己任务文件），先向主任务报告；最多两组并发。最终整仓Maven由主任务执行。
- 测试按风险分层，相关开发检查后，阶段末一次全量前端/Java/HTTP/桌面手机/CI；不因纯文案或测试改动无条件重复所有重测。

## 任务 A：租户、功能开关与字典

**文件边界：** `platform/application/PlatformTenantApplicationService`、其API与mapper、`tenant`能力/功能目录、`dictionary`模块、平台 `tenants-page` / `dictionaries-page` / `announcements-page`。平台App的 canManage 连接可由本任务实现；其他端App和全局导航由主任务集成。

**接口：** 稳定套餐/功能目录，现有create/plan/features兼容；明确配置失败语义；`buyer/capabilities`反映实际有效方式与模块。字典GET仍供业务读取，固定状态码不接受任意扩展。

- [ ] 写明权限、套餐别名、未知功能键、全部关闭/继承、部分保存与字典审计/历史项的回归用例并验证缺口。
- [ ] 完成原子或独立保存、受控功能目录、只读管理页、真实字典消费及操作反馈。
- [ ] 定向单测/事务或API测试，保留现有功能关闭后的存量读取与履约边界；记录证据并独立复核。

## 任务 B：组织和成员权限完整性

**文件边界：** `identity`的 BuyerRole/BuyerUser 服务、mapper、请求/响应和角色识别策略；`team-page`、`role-permission-workbench`、共享成员编辑器及必要org回归。

**接口：** create/update成员支持可选roleIds并兼容roleId，单次请求原子保存；管理读取停用账号的全部分配角色，生效权限仍过滤inactive。系统角色响应标明保护状态。

- [ ] 先覆盖active/inactive、真实租户所有者角色、最后管理员移除/并发、多角色原子保存及停用后再编辑。
- [ ] 实现事务锁及最后有效管理员保护、主管清理、前后端一致的状态/权限反馈。
- [ ] 用真实PostgreSQL验证并发，前端验证无权限/失败保留草稿；独立复核。

## 任务 C：统计及导出同口径

**文件边界：** BuyerAnalytics服务/controller/mapper/DTO；finance报表controller/service及专属统计renderer；`analytics-page`、`dashboard-page`及相关测试。

**接口：** 统计GET及对应导出接受同一 `fromDate/toDate/supplierId/status`，默认最近12自然月，Asia/Shanghai，最大60个月；返回实际筛选、口径版本、生成时间、金额来源及估算边界。导出同一结果的数值型XLSX与等价PDF，不改发票报表。

- [ ] 覆盖跨月/跨年/末日、零月份、取消/待确认等状态定义、同范围各分组合计、历史轮次/重复定标、不授权数据及导出数值精度。
- [ ] 实现一致读快照、可信标签、同源导出、首页同口径及失败不伪零。
- [ ] 核验xlsx单元格类型、PDF各节、筛选联动和数据范围；独立复核。

## 任务 D：通用 AI 后端与业务证据适配器

**文件边界：** 新 `common/ai` 与 `ai` 模块；各 `demand/attachment/supplier/sourcing/application` 的AI适配器及必要中立投影；V230；相关后端测试。不得修改学校专用POC业务规则。

**冻结API：** `POST /api/v1/buyer/ai/reviews`，请求 `{subjectType:'demand'|'attachment'|'supplier'|'procurement_risk',subjectId,expectedRevision?}`；GET同路径用subjectType/subjectId获取历史；GET `/{runId}`详情；POST `/{runId}/feedback` 请求 `{findingId,disposition:'adopted'|'dismissed'|'needs_review',comment}`。企业制度版本管理在 `/api/v1/buyer/ai/policies` 下，具体DTO由该任务提供给UI。权限采用 `buyer:ai:read/use/manage`，还必须满足来源业务访问权限；角色目录和路由由主任务最终合并。

**核心响应：** `runId,subjectType,subjectId,sourceRevision,createdAt,mode,model?,fallbackReason?,rulesetVersion,summary,findings,evidence,limitations,feedback`；finding含 `id,severity,title,detail,evidenceIds`，证据含 `id,kind,locator,label,value,sourceId,sourceHash?,policyVersion?`。规则模式无伪置信度。报告的 `expectedRevision` 不匹配返回明确冲突，历史不随源资料修改而重写。

- [ ] 编写越权历史/反馈、无配置零外呼、证据伪造/风险降级、缺制度、附件不可读及文本限长等红绿用例。
- [ ] 实现四适配器、不可变快照/历史/反馈、企业制度版本、受控可选网关和明确的规则/回退模式。
- [ ] 真实本地HTTP验证四类资料及历史/反馈，不调用业务审批写入；模型测试只证明兼容协议和校验，不宣称真实外部大模型已联调。

## 任务 E：自动编号与真实业务创建

**文件边界：** 新 `numbering` 模块、V229、PurchaseDemandApplicationService/DirectDemandRegistrar/必要mapper、TenderApplicationService/mapper，以及企业编码配置页和API客户端专属文件。

**接口：** `/api/v1/buyer/numbering-rules` GET列表，PUT `/{businessType}`配置，POST `/{businessType}/preview`仅样例；支持 `demand/tender` 两类，前缀、有限日期格式、位数、enabled。既有默认格式保留，预览不消耗计数；规则仅影响新编号、旧记录完全不改。权限企业管理 `buyer:role:manage`，普通业务不能保存。

- [ ] 先覆盖两条需求创建路径、跨企业相同前缀、同一规则并发、修改规则不复用旧号、无规则默认格式、预览无计数及历史ID保留。
- [ ] 共享原子分配与格式器，接通普通需求/直录/招标创建和设置页的保存/预览/错误反馈。
- [ ] 实际HTTP验证配置后两类新单据编号生效；独立复核。

## 任务 F：AI共用前端与统一集成（主任务）

**文件边界：** `apps/tenant-portal/src/features/ai/*`，`packages/api-client/src/ai-reviews.ts`，需求/附件/供应商/项目执行详情仅加入入口和面板，不重排旧业务布局；企业制度管理页、App/导航/权限目录及OpenAPI生成统一集成。

- [ ] 在任务D响应契约确定后补共享面板行为测试：正确subject、权限、失败/过期不串用旧结果、证据/限制、历史、反馈及政策版本配置。
- [ ] 四类入口真实接入，不以只读占位替代；来源权限不足时隐藏或拒绝，不隐式写审批意见。
- [ ] 使用隔离真实数据逐类验证，保持与原系统按钮、抽屉及列表风格一致，桌面/手机无溢出。

## 统一交付

- [x] 核验上一阶段真实发布029f、原库及固定服务；原基线前端536测试通过。历史HANDOFF中未发布段落仅为旧快照，不重复实现。
- [ ] 各任务独立审查与最终整仓审查，修复关键问题，更新当前完成度台账及操作说明。
- [ ] Java21全量单元/集成及必跑IT检查、七包类型、前端全测、四端构建、OpenAPI/dates/diff检查。
- [ ] 隔离HTTP全链路与桌面/手机验收，保留真实权限、导出内容、AI模式/证据及人工操作记录。
- [ ] 原库/附件新备份和副本迁移预演；PR及CI、受保护合并、固定构建、原数据发布和原表/附件核验，四端真实登录及只读页面验收。

## Review Focus

1. 只读管理员或末位管理员是否仍能发生错误授权/自锁；并发停用与多角色替换是否绕过保护。
2. 功能全部关闭与继承默认是否混淆，是否误阻断存量付款/归档整改；字典是否伪造业务状态。
3. 日期/数据范围/订单金额与估算、报价差额是否混用，PDF和XLSX是否与页面同口径且没有隐藏越权数据。
4. AI历史/证据/反馈是否绕过当前来源权限，未读文件是否被误写成已审，模型能否删改已知风险或伪造依据。
5. 自定义编码在并发、跨企业或规则修改后是否冲突，预览是否消耗真实流水；发布是否误覆盖原库/桶或重跑种子。

## 执行记录

2026-10-24：原规划已从本会话日志准确恢复；四组只读代码核查完成，基线前端108文件536测试通过。已冻结设计及上述任务，开始按业务包实现。
