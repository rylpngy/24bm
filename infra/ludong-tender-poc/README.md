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
超期不自动批准或驳回。手机完整验收、Word逐页视觉检查及报价/合同必演仍待后续完成。
