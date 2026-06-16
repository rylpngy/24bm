# 阶段二验收与联调准备清单

## 验收目标

阶段二先暂停自动业务重构，确认当前 Java 后端 MVP 的真实完成度，并为平台端、采购方端、供应商端三端联调建立可执行清单。

## 当前基线

- 正式后端方向：`backend-java/`
- 历史原型边界：`server/`、`scripts/*legacy*`、`data/procurementModel.ts`
- 前端 Java 入口：`npm run dev:java`
- Java 本地后端：`backend-java/` + `local` Spring profile
- 本地数据库：`backend-java/docker-compose.yml` 中的 PostgreSQL
- API smoke：`npm run java:smoke`
- 常规验证：`npm run verify`

## 一、正式后端边界验收

| 项目 | 当前结论 | 验收依据 |
| --- | --- | --- |
| Java 后端是否为正式方向 | 已确认 | `README.md`、`backend-java/README.md`、`docs/local-java-integration.md` 均指向 `backend-java/` |
| Node 后端是否冻结为原型 | 已确认 | `package.json` 中 Node 命令使用 `legacy:*` 命名，文档要求不要继续扩展 `server/` |
| 前端是否支持 Java 后端 | 已具备 | `npm run dev:java` 设置 `VITE_JAVA_API_BASE_URL=http://localhost:8080` |
| Mock 模式是否保留 | 已保留 | `npm run dev:mock` 用于纯视觉检查，不作为业务后端来源 |

## 二、真实运行联调验收

| 项目 | 验收命令 | 期望结果 | 当前状态 |
| --- | --- | --- | --- |
| Docker daemon | `docker info` | Server 信息可用 | 已通过 |
| PostgreSQL 启动 | `cd backend-java && docker compose up -d` | `procurement-saas-postgres` 运行并健康 | 已通过，使用本地可用的 `postgres:16-alpine` |
| Java 后端启动 | `cd backend-java && mvn clean spring-boot:run -Dspring-boot.run.profiles=local` | `http://localhost:8080/api/v1/health` 可访问 | 已通过，Flyway 校验 6 个 migration，schema 当前版本 v100 |
| API smoke | `npm run java:smoke` | 平台、采购方、供应商登录和主流程 smoke 通过 | 已通过，完整链路跑到已付款 |
| 前端 Java 启动 | `npm run dev:java` | Vite 页面使用 Java API 数据加载 | 部分通过：Vite 已启动，页面可打开；内置浏览器访问 `localhost:8080` 被客户端拦截，需用普通浏览器继续逐页验收 |

## 本轮联调发现与处理

| 问题 | 处理结果 |
| --- | --- |
| Docker 本地没有 `postgres:16` 镜像且网络拉取不稳定 | `backend-java/docker-compose.yml` 改为 `postgres:16-alpine`，复用本地镜像并成功启动 |
| `mvn spring-boot:run` 可能加载陈旧 `target/classes` migration | 本地启动和验证命令统一改为 `mvn clean ...` |
| MyBatis `@Results` setter 风格映射 Java record 在真实数据库链路中失败 | Mapper 改为构造器/默认 record 映射，认证用户保留显式构造器映射 |
| PostgreSQL 无法推断 `? is null` / `concat('%', null, '%')` 参数类型 | 列表筛选查询改为 MyBatis 动态 SQL，空筛选项不进入 SQL |
| smoke 直接用已存在种子需求创建 RFQ，复跑会被“需求已绑定 RFQ”规则拦截 | smoke 改为每次创建并审批新的联调需求 |
| smoke 定标后直接生成订单，缺少定标审批步骤 | smoke 补齐定标审批通过后再生成采购订单 |
| 内置浏览器可打开 Vite，但访问 Java API 返回 `ERR_BLOCKED_BY_CLIENT` | 暂不判断为应用缺陷；API 已由 `npm run java:smoke` 验证通过，三端页面实点建议用普通浏览器继续 |

## 本轮验证结果

| 命令 | 结果 |
| --- | --- |
| `npm run java:smoke` | 已通过，完整跑通需求审批、RFQ、报价、定标审批、订单、供应商确认、发货、收货、发票、付款状态 |
| `npm run dev:java` | 已启动，Vite 地址 `http://localhost:3000/` 可打开 |
| 内置浏览器页面检查 | 页面可打开；Java API 被内置浏览器环境拦截，仍需普通浏览器做三端逐页验收 |
| `npm run verify` | 已通过，包含 OpenAPI 同步检查、Vitest、Vite build、`mvn clean test` |

## 三、三端页面联调验收项

### 平台端

- 登录平台账号 `platform.admin@example.com`。
- 验证平台工作台加载租户数量、活跃租户数量、公共供应商数量、待审核企业数量。
- 验证租户列表、租户详情、功能开关、套餐和用户上限维护。
- 验证企业入驻审核。
- 验证平台公告发布，以及采购方/供应商公告可见范围。

### 采购方端

- 登录采购方账号 `buyer.owner@example.com`，租户 `tenant-acme`。
- 验证采购方工作台加载供应商、物料、用户、待办、审批历史、通知、需求、RFQ、订单、发票。
- 验证供应商私域关系：创建、准入提交、准入审批、拉黑、恢复、资料维护、绩效维护。
- 验证物料/服务目录、组织部门、采购方用户、角色维护。
- 验证主流程：需求申请、需求审批、创建 RFQ、邀请供应商、比价定标、定标审批、生成订单、收货、付款状态登记。

### 供应商端

- 登录供应商账号 `supplier.sales@example.com`，供应商 `ent-supplier-sunrise`。
- 验证供应商工作台加载企业档案、商机、报价、销售订单、应收、通知。
- 验证企业档案维护、资质维护、子账号维护。
- 验证收到 RFQ 邀请后提交报价。
- 验证订单确认、发货登记、发票登记。
- 验证付款状态和付款审计记录可查看。

## 四、MVP 主流程验收用例

| 编号 | 用例 | 入口 | 期望 |
| --- | --- | --- | --- |
| MVP-01 | 平台开通租户 | 平台端租户管理 | 创建租户、默认角色、固定审批模板和审计记录 |
| MVP-02 | 采购方维护基础资料 | 采购方端 | 部门、用户、物料、供应商关系均在当前租户内隔离 |
| MVP-03 | 采购需求申请与审批 | 采购方端 | 草稿需求提交后进入审批中，审批通过后可用于 RFQ |
| MVP-04 | RFQ 创建与供应商邀请 | 采购方端 | 仅允许已通过需求和已准入供应商参与 |
| MVP-05 | 供应商报价 | 供应商端 | 被邀请供应商可提交一次有效报价 |
| MVP-06 | 比价定标与审批 | 采购方端 | 定标审批通过后 RFQ 进入已定标 |
| MVP-07 | 订单生成与供应商确认 | 采购方端、供应商端 | 已通过定标生成订单，供应商确认后进入待发货 |
| MVP-08 | 发货与收货 | 供应商端、采购方端 | 供应商发货后采购方可收货，订单进入已收货 |
| MVP-09 | 发票与付款状态 | 供应商端、采购方端 | 已收货订单可登记发票，采购方可登记部分付款或已付款 |
| MVP-10 | 审计与通知 | 三端 | 关键动作写入审计，相关用户收到站内通知 |

## 五、下一阶段决策建议

1. 先补齐真实本地联调基线：Docker PostgreSQL、Java 后端、`npm run java:smoke`、`npm run dev:java`。
2. 联调通过后，再做一次三端页面验收截图或录屏，确认前端 Java overlay 没有只停留在 mock 数据。
3. 若要进入可演示版本，优先补环境启动脚本、登录账号说明、种子数据重置方式和联调问题清单。
4. 若要进入生产化版本，优先补集成测试、细粒度权限、文件上传、部署配置、日志和监控。
5. 业务扩展应放在联调稳定之后，再进入商城直采、竞价、合同、三单匹配等第二阶段功能。
