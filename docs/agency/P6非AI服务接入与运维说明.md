# P6 非AI服务接入与运维说明

按用户2026-11-10授权连续完成非AI研发。AI待配置后接入；全流程电子标等待用户确认后再制定计划，当前不纳入研发。

## 服务配置

本地隔离测试可先运行 `python3 scripts/p6-init-contract-secrets.py`，仅生成被Git忽略、权限0600的本地契约密钥，已有密钥不会覆盖。`p6-run-backend.py`默认不启用Office或短信；本地契约脚本须按需使用 `P6_OFFICE_ENABLED=1`、`P6_SMS_CONTRACT=1`、`P6_SSO_CONTRACT=1`。这些标记只用于固定回环端口的合成联调，不能带入生产配置。P6脚本依赖已初始化的P0/P3隔离合成项目，不针对真实业务记录执行。

配置示例为 `infra/p6/non-ai.env.example`。通过部署环境或密钥服务注入值，不将填好的文件提交到仓库。只读检查命令：

```sh
python3 scripts/agency-deployment-check.py --profile production --env-file /secure/deployment.env
```

该命令检查配置，不启动部署、不发送短信、不访问客户身份源。通过配置检查不能替代生产验收。

## 在线Office

采用OnlyOffice Docs兼容的编辑配置、独立JWT、受限源文件能力票据、签名回调和受限缓存下载。源文件绑定租户、会话、精确DOCX版本、结构化输入版本及项目依据指纹。会话两小时过期；原稿或依据变化时拒绝旧回调和采纳。

编辑副本不可变封存。请求保存仅表示发出请求；status 6回调保存副本，status 2表示最终保存、进入待采纳。人工核对最新副本后创建新的上传候选稿，不继承旧审批。重复回调按指纹去重；已关闭或过期会话不能再写入。

`infra/p6/compose.office.yml`只用于独立技术环境，固定镜像摘要，仅监听回环端口。当前宿主Docker资源不足时本次容器发生OOM，已停止；实际编辑器端到端兼容验收仍未通过。生产资源与许可应按实际版本和采购渠道确认。官方协议参考：[JWT](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/security/)、[保存回调](https://github.com/ONLYOFFICE/api.onlyoffice.com/blob/master/site/docs/docs-api/usage-api/callback-handler.md)。

本次签名HTTP契约测试不等同于真实编辑器联调。实际DOCX采购样例暂未提供；复杂目录、域、页眉页脚、修订、签章和真实模板须单独兼容验收。服务未启用时保留整稿下载、本地Word编辑及人工上传路径。

## 非AI文档处理

PDFBox 3.0.8读取PDF文本层；扫描页及PNG/JPEG通过本地Tesseract（chi_sim+eng）识别，不调用生成式AI。返回页码、行号或表格/行/单元格/段落定位，以及明确的识别范围与限制。DOCX支持最多四层表格文本，跨行跨列表格语义和OCR数字仍需人工核对。受保护PDF不绕过提取限制。

输入上限10MB，PDF最多20页、扫描OCR最多10页、4万字符和160段，OCR图像最多1200万像素。OCR进程30秒、单文档转换40秒，单实例本地文档进程并发1；繁忙或失败均返回明确错误。正式容量须另做实际文档压测。

PDF预览由LibreOffice对指定候选DOCX生成，不改变当前版本、审批状态或签署状态。转换前限制ZIP展开和条目数量、禁用XML外部实体，并拒绝非超链接的外部资源及动态外部域。预览通过异步任务封存为PDF附件，保留源版本和双方SHA256。每个任务使用独立临时目录及LibreOffice用户配置目录，结束后清理本次临时文件。

部署运行时须安装对应工具、中文字体及OCR语言包，系统不会自动安装。当前本机技术验证使用Homebrew Tesseract与已安装LibreOffice；语言包位于被Git忽略的私有运行目录，部署时需自行提供。PDFBox版本见[官方下载页](https://pdfbox.apache.org/download)。

## 短信网关契约

应用提供签名HTTP网关适配器；实际短信厂商、账户、模板审批及企业网关地址尚待配置。未配置时禁止发送。租户还须单独启用通道、设置日配额、人工核验内部人员号码归属和接收授权，再逐条授权一个已经形成的项目站内计划提醒。不会自动把站内通知转发为短信。短信只含通用登录提醒，不包含采购文件、报价或专家身份。

联系人使用独立AES-256-GCM密钥加密，AAD绑定租户及用户；页面仅返回掩码，支持撤销接收授权。此人工核验不冒充短信OTP验证。发出前再次校验授权人员、项目范围、计划/提醒策略版本、联系人授权及24小时外发时效；每日配额以Asia/Shanghai计数。

网关POST地址由 `AGENCY_SMS_URL` 配置。请求头为 `Idempotency-Key`（外发记录ID）、`X-24BM-Timestamp`（Unix秒）、`X-24BM-Signature`。签名为独立密钥对 **timestamp + "." + 原始UTF-8 JSON字节** 的HMAC-SHA256小写十六进制值。网关响应也须携带相同规则签名，允许时钟偏差5分钟，不接受重定向。请求包括tenantId、clientId、recipient、固定template `agency_reminder_v1`及parameters.message；网关须按clientId幂等受理。

受理响应须为HTTP 200，包含clientId、status=accepted、providerRef。明确未受理返回签名status=rejected；其余响应、超时、签名错误或发送中断都记为unknown。响应最多16KB，HTTP处理有总时限。accepted仅表示网关受理。

送达回执POST到 `/api/v1/buyer/agency/sms-bridge/receipt`，采用同一签名头和时限，JSON字段为tenantId、deliveryId、providerRef、status（delivered或failed）。校验签名、外发编号和供应商编号后记录不可变回执；相同回执重放去重，终态不倒退。传输请求和结果另存审计记录，不保存完整号码或原始签名请求。

仅网关明确未受理且无供应商编号的失败可再次人工授权重试，沿用原幂等编号并重新计入日配额。unknown、accepted或已有供应商编号的记录禁止盲目重发，应等待签名回执或向真实网关核对。发送进程超过两分钟未完成会转unknown。停用通道或撤销授权会阻止待发送任务；已受理短信无法由本系统撤销。

本次只调用自建回环网关和合成保留号段，没有向真实联系人发送短信；契约测试不能代替真实厂商送达测试。

## SSO与恢复

复用底座外部身份映射：RS256经JWKS验签，校验issuer、audience及时效，以issuer/subject绑定本地在职人员，本地角色和项目范围决定权限，不信任外部token自行声明的租户或角色。严格映射模式、退出自签登录及应急管理员恢复须在客户身份源确认后启用；本地协议测试不代表客户IdP验收。

`scripts/p6-combined-restore.py`仅面向固定的24Bm隔离技术环境：停止已核验的本应用写入进程，备份全部数据库表及对象原文，在全新数据库和桶恢复，核对全表完整行指纹、对象SHA256/大小以及封存附件引用，最后删除本次恢复目标并恢复本地应用。`--backup-dir .p0/p6-recovery-时间戳` 可仅从已完整捕获的私有备份重做恢复，不再停止当前应用。对象回写限制分块16MiB、并发1，避免客户端默认大缓冲耗尽本地资源。原数据库和原桶不覆盖。私有备份仅存放Git忽略的 `.p0` 目录并限制权限，不放入交付证据。

正式运维仍需明确备份保留、离机或异地副本、密钥托管、监控告警、值守责任和业务RPO/RTO，并在实际目标环境完成恢复及客户身份源生命周期验收。技术恢复耗时与本地读取观测不作生产容量或恢复时间承诺。
