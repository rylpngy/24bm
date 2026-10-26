# 鲁东大学正式磋商 POC 独立开发环境

本环境复用当前24Bid及学校POC模块，不是旧版POC的恢复，也不是生产交付完成声明。

|组件|地址或标识|
|---|---|
|采购人|http://127.0.0.1:5288/?solution=ludong-poc|
|供应商|http://127.0.0.1:5289/|
|API|http://127.0.0.1:8098/api/v1/health|
|数据库|127.0.0.1:26432 / ludong_tender_poc / ludong_poc|
|附件服务|127.0.0.1:29000，控制台29001|
|附件桶|ludong-tender-attachments|
|Compose项目|24bid-ludong-tender-poc|

原系统5173—5176/8080不改变，原数据库、旧POC及附件不挂载、不清理、不覆盖。

## 启动与更新

前置：Node22、pnpm、Maven、Java21、Docker Compose。本机Java默认路径
`/opt/homebrew/opt/openjdk@21`；其他机器通过`JAVA_HOME`指定，不能用其他版本冒充验收。
从仓库根目录执行：

```bash
node scripts/ludong-tender-environment.mjs prepare
node scripts/ludong-tender-environment.mjs start
node scripts/ludong-tender-environment.mjs status
```

`prepare`仅准备此Compose项目、离线安装锁定依赖、构建Java，不代表测试通过。
`start`检查专属应用端口是否空闲，冲突时拒绝启动，不杀其他服务。
数据库和附件使用专属命名卷。启动脚本不提供清库或删除数据入口。

更新Java后先构建，再执行：

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -f backend-java/pom.xml -q -DskipTests package
node scripts/ludong-tender-environment.mjs restart-backend
```

只重启本工作区记录的POC后端PID，且核验实际JAR路径。运行JAR复制到本地不可变发布副本，
后续构建不会覆盖运行中的JAR。开发门户使用Vite热更新，最终彩排前另行冻结构建。

本地生成的随机数据库密码、对象存储密码和JWT密钥存于忽略目录
`.ludong-tender-runtime/secrets.json`，权限0600。不提交Git，不作为客户通用密码。
日志、PID和HTTP验收结果同样在该目录，不把含业务或身份信息的日志公开提交。

## 账号与业务边界

以下均为隔离演示账号，初始密码`demo123456`。仅限回环开发环境。

|身份|工号/账号|
|---|---|
|POC管理员|LDU000001|
|项目申报人|LDU100001|
|购置必要性论证人|LDU200001|
|教育信息技术部审核人|LDU200002|
|申报单位负责人|LDU200003|
|供应商甲/乙/丙|ldu.supplier.a@example.com / ldu.supplier.b@example.com / ldu.supplier.c@example.com|

供应商登录页的企业编号依次为`ent-ldu-demo-a`、`ent-ldu-demo-b`、`ent-ldu-demo-c`。
本环境关闭Keycloak登录入口，使用隔离的本地演示认证；不代表已对接学校统一身份认证。

供应商种子只在显式开启`db/poc/ludong-tender`时运行，未写入通用正式迁移或旧POC种子。
供应商资质原件未伪造，不插入指向不存在文件的storage_key；邀请前需在本环境上传有效测试资质。
新增学校项目库、预算、询比、合同入口复用底座页面及后端，不代表学校数据主链已经全部贯通。

## 验收与后续任务

`node scripts/ludong-tender-workflow-smoke.mjs`只访问固定8098，通过API新建完整材料样本，实际提交并推进首个审批节点，
验证转审、抄送、时限、旧办理人权限失效及业务状态一致性，不向原系统写入数据。
不会自动清除测试记录。剩余任务、评分口径见`docs/ludong-tender-poc-checklist.md`。
未完整验收流程配置、全部报价细项和合同智能审查前，不应声明三项必演全部通过。

`node scripts/ludong-tender-environment-smoke.mjs`验证两端同源代理、三个供应商登录，以及
独立MinIO上传、下载和SHA256字节一致性。它会添加一份明确标记的合成测试附件，不清理历史附件。

`node scripts/ludong-tender-rework-smoke.mjs`验证原生加审、指定前序节点退回、撤回和修改重提。
脚本固定访问8098，不清库；新建合成项目并跑完最终审批，下载两份Word和ZIP到
`.ludong-tender-runtime/rework-acceptance/`。它检查最新轮次的材料和签署，不代替Word逐页视觉验收。

操作演示：以LDU200001办理首节点，在“任务协同”选择加审并指定有效审核人；以对应工号登录填写加审意见后，
由原办理人继续主审批。前序节点办理完成后，下游办理人可选择已完成的前序节点退回并填写原因。
申报人LDU100001可在本人在办项目详情撤回，修改草稿后重新提交；“历次审批”保留原轮次资料。
加审不同意不能绕过继续通过；退回后原签署失效且须重新审核；目前指定节点退回只支持串行单任务流程。

## 流程配置、附件和时限验收

管理员在“流程配置”打开配置器：审批节点可指定办理人/角色/部门主管，设置1—8760自然小时办理时限。
“附件要求”可改基础分类名称、增加最多五类材料及设置“提交必备”；发布后仅新发起实例使用新版本。
旧版未启用附件配置时，不额外拦截原申报。新增节点使用结论/意见表单；不表示任意自定义业务表单均已完成。

```bash
node scripts/ludong-tender-configuration-smoke.mjs
node scripts/ludong-tender-configuration-smoke.mjs --verify-overdue
```

脚本固定访问8098，创建合成项目，验证金额分支、办理人、版本隔离、必备附件、最终审批和真实ZIP内容；
结束时恢复原已发布内容及草稿，保留不可变版本和全部测试记录。
`--verify-overdue`额外只回拨本脚本新建任务在独立26432数据库的截止时间，验证超期通知和防重复，
不会更改原系统、其他任务或系统时间。仅在此独立Compose环境使用，不作为生产操作脚本。

自然小时时限不包含节假日工作日历。定时超期提醒由`app.workflow.deadlines.enabled=true`显式启用，
间隔参数为`app.workflow.deadlines.interval-ms`，默认60000毫秒；独立POC启用且设置10000毫秒。
超期不自动批准或驳回。手机完整验收、Word逐页视觉检查及合同必演仍待后续完成；报价必演见下。

## 完整报价与延期演示

采购方管理员进入`http://127.0.0.1:5288/?solution=ludong-poc&module=rfqs`；供应商进入5289的询价项目。
询比草稿或报价中、尚无人报价时，在详情“分项报价与截止规则”开启完整报价，可同时配置不足三家自动延期的小时数和次数上限。
历史项目默认不开启，不强制补齐升级前未留存的字段。完整报价后不能再通过普通编辑覆盖本轮要求。

供应商填写全部行的品牌型号、技术参数、响应/偏离、含税单价，以及税率、交期、发票类型和报价原件。
截止前“修改报价”生成新版本，版本按钮查看旧快照；原件支持按权限下载及SHA256核验。
开标前采购方不展示金额和技术原件，只展示参与/完整报价家数。开标后可查看横向比较矩阵和版本，并导出四工作表Excel。
“有效报价”仅指本轮受邀供应商的完整报价，不能据此自动认定技术合格或自动定标。

自动延期扫描配置`app.rfq.quotation-extensions.enabled=true`，默认关闭；本独立环境显式开启，扫描间隔10000毫秒。
每轮按设置限制自动次数，人工延期必须填写原因并校验原截止版本；重复相同请求不重复执行。此规则仅用于询比，不改变竞价软关闭。

```bash
node scripts/ludong-tender-quotation-smoke.mjs
node scripts/ludong-tender-quotation-smoke.mjs --prepare-ui
```

首条创建三供应商、两项设备的合成项目并完成报价/版本/延期/开标/导出验收；第二条只准备未报价项目供浏览器操作。
脚本固定8098，所需资质原件为明确标识的合成测试文件，绝不创建指向不存在文件的证照。
测试仅回拨本次新建RFQ在独立数据库的截止时间，不改原系统或系统时间；保留全部测试记录。
实际结果与文件位于忽略目录`.ludong-tender-runtime/quotation-acceptance/`，不提交密钥或身份令牌。

## 合同智能审查

管理员进入`http://127.0.0.1:5288/?solution=ludong-poc&module=contracts&view=review`，或“采购合同→智能审查”。
“规则配置与版本”新建规则集，增改规则，保存草稿后发布；发布版本不可覆盖，旧审查继续引用原版本。
可导入明确标识的演示规则；它们不是学校正式制度，正式使用前由业务/法务确认依据。

上传2MB内DOCX或UTF-8文本，在审查设置选已发布版本及甲方/乙方视角；“仅规则检查”不外发正文，
“规则+AI审查”主动将本次正文及配置依据发送至已配置服务。原文位置与引文由系统绑定，不接受模型编造的位置或引文。
点击风险位置定位对应版本正文；确认修订时检查完整段落、修改建议并填写人工说明。
采纳生成新校对稿，原件及正式合同条款不变；正文变化后剩余旧意见不能继续套用，须重新审查。
人工确认历史保留采纳/不采纳、前后文本、操作者和时间；原件、历次校对稿均可下载。

目前不支持PDF/扫描件/OCR及任意Word排版的保真修订；校对稿导出不代替签署正本。
模型不可用、引用或结构校验失败会明确标识“未评估”，不当作无风险或审核通过。
模型建议中的无依据商务数值及文件名称不会直接采用；不能以系统约束保证AI判断100%准确。

模型配置只由部署人员在本地忽略文件`.ludong-tender-runtime/contract-model.json`提供，权限0600。
环境脚本仅加载以下四个字段，不通过前端配置或返回密钥：

|字段|说明|
|---|---|
|CONTRACT_REVIEW_MODEL_ENABLED|显式true启用，其他环境默认不启用|
|CONTRACT_REVIEW_MODEL_ENDPOINT|完整HTTPS兼容接口，末尾为/chat/completions；禁止将密钥放入地址|
|CONTRACT_REVIEW_MODEL_API_KEY|通过安全途径提供；不随Git交付|
|CONTRACT_REVIEW_MODEL_NAME|模型名称；本次实际验证为qwen-plus|

仅支持受信任HTTPS服务（本地测试允许回环HTTP），不跳过证书校验或跟随重定向。
每次最多两项模型调用，超时或服务失败显式回退；没有把原审批AI配置顺带切换到本服务。

```bash
node scripts/ludong-tender-contract-review-smoke.mjs
node scripts/ludong-tender-contract-review-smoke.mjs --model
```

第一条验证规则与人工修订闭环；第二条额外向已授权模型服务发送合成材料，真实验证甲乙方语义审查，可能产生服务用量。
脚本固定8098，不清库、不删除历史；所有合同、规则及审批内容均明确标为合成验收样本。
结果、合成DOCX原件和修订稿保存在`.ludong-tender-runtime/contract-review-acceptance/`。
