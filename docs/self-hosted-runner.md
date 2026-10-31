# 24Bid自建CI运行器

## 当前状态

2026-10-31，仓库为私有仓库，GitHub注册的Runner数量为0。工作流已准备切换为`[self-hosted, linux, 24bid-ci]`，实际执行机地址尚待确认；不能将代码准备完成写成Runner已上线、CI通过或main已合并。

本地配置检查：YAML结构及权限/端口断言通过，19个工作流shell块与两个安装/检查脚本通过`bash -n`；两脚本均在当前macOS主机上先拒绝执行。`CI=1 playwright test --list`收集到19文件62用例，仅是收集成功，不是E2E执行通过。未改动业务服务，原8080健康正常。

## 部署边界

- 使用专用Ubuntu 24.04 LTS服务器或独立Linux虚拟机，建议4核、8GB内存、60GB可用磁盘起步，依实际构建量调整。
- 不直接部署到当前macOS开发账号，不与5173/8080业务实例共用主机、Docker守护进程或数据卷；不挂载开发者目录、Git凭据、SSH私钥、生产数据库和附件桶。
- 单独的非root账号，只注册本仓库的一个Runner，默认串行执行任务；Docker访问权等同高权限，必须以隔离机器为安全边界。标记文件和PR条件只防误用，不是恶意代码沙箱。
- 基础软件：Docker Engine、Git、curl、tar、Python3、Maven、sudo及GitHub Linux Runner依赖。管理员预装Chromium所需系统依赖，或允许其安装；工作流保留`playwright install --with-deps`。Java21、Node22、pnpm由原有setup步骤管理。
- 不接触现有原系统和鲁东环境，不自动发布业务服务，不自动合并PR。

## 注册与启动

1. 确认执行机地址、SSH端口和专用账号。密钥从本机安全使用，不在聊天、Git或CI日志中发送密码/PAT。
2. 通过GitHub仓库Settings → Actions → Runners → New self-hosted runner选择实际Linux架构，获取官方归档地址、SHA256和有效期1小时的注册令牌。也可由管理员通过官方REST API获取。令牌只在内存/专用安装会话中传递，不写入仓库。
3. 在专用非root账号下设置`DEDICATED_CI_HOST=1`、`RUNNER_DOWNLOAD_URL`、`RUNNER_SHA256`、`RUNNER_REGISTRATION_TOKEN`，运行`bash scripts/ci/register-runner.sh`。脚本拒绝覆盖既有目录并校验归档SHA256，不能关闭校验来绕过下载问题。
4. 管理员进入安装目录，使用官方`svc.sh install <专用账号>`和`svc.sh start`配置系统服务。保留自动更新。PAT不需要留在Runner执行环境。
5. 确认仓库显示Runner为Online、标签含`self-hosted`、`Linux`及`24bid-ci`，再推送工作流或对包含新工作流的分支发起运行。
6. 原先`ubuntu-latest`失败运行的“重跑”仍使用旧版工作流，不能据此切换执行机；必须运行包含新配置的提交。三类检查均真正执行并通过后，才处理main合并。

## CI改动与验证

- 三类检查及名称保留：Java单测和Testcontainers集成、前端类型/单测/运维工具/构建、Playwright四门户。
- GITHUB_TOKEN只授予contents读取，checkout不保留凭据；不接收外部fork PR任务，不使用`pull_request_target`。同仓库写入者及依赖仍需被信任。
- PostgreSQL为每个E2E任务新建的服务容器，绑定随机本机端口；显式DB_URL防止连接默认5432业务库。
- Keycloak使用本次运行专属名称及标签；结束时只清理本任务创建的容器和记录的后台进程，不使用全局Docker prune或按端口杀进程。
- CI禁止复用已有前端服务。端口被占用则失败，不强停未知服务。后台运行异常遗留由管理员核对归属后处理。
- 移除GitHub云端依赖缓存和报告上传，构建工具使用执行机本地存储；E2E报告留在`$HOME/24bid-ci-reports/<运行号>-<尝试号>/`，由管理员制定容量和保留策略，不能无限堆积。
- workflow有超时及同PR旧运行取消；取消/机器故障后也须检查残留服务。配置验证不等于实际Linux服务验收。

## 成本说明

按当前GitHub官方说明，自建Runner计算用量免费，不使用GitHub托管Runner分钟。但服务器、虚拟机、存储、网络和维护仍有成本，不能承诺永久零费用。未来政策以官方文档为准。

参考：https://docs.github.com/en/actions/concepts/billing-and-usage 、https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners 、https://docs.github.com/en/actions/reference/security/secure-use 。
