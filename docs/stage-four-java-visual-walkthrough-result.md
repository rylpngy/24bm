# 阶段四 Java 模式视觉验收结果

## 验收结论

第56轮已补跑 Java 模式付款批次视觉验收。本轮修复了本地 Java 模式 CORS 配置，支持 `http://127.0.0.1:3001` 验收端口和 Java `PUT` 状态动作；随后通过 Chrome CLI 产出桌面 1280x720、移动 390x844 截图，并通过 DOM 文本检查确认页面进入采购方 `发票付款` 模块、付款批次详情和处理记录台账。

第58轮已将付款阻断处理记录从空态验收推进到非空回显验收：视觉脚本会在截图前通过 Java API 为默认付款批次创建或更新 `Java visual smoke 阻断处理记录`，再检查付款批次详情的处理记录台账中出现该记录；Java local smoke 同步覆盖 `Java smoke 阻断处理记录` 的创建、更新和查询。

第79轮已补跑归档审计面板视觉验收：视觉脚本在同一 Java 模式深链中继续检查付款批次详情里的 `归档审计面板`、`审计追踪入口`、归档冻结边界、付款登记摘要和处理记录入口，确保第78轮新增的归档审计聚合面板在桌面和移动截图对应 DOM 中可见。

## 已确认

- Java local API health passed at http://localhost:8080。
- Java 模式前端已启动在 http://127.0.0.1:3001/，不影响现有 http://localhost:3000/ 前端服务。
- 视觉补跑深链为 http://127.0.0.1:3001/?role=buyer&module=invoices，可直接进入采购方 `发票付款` 模块。
- 采购方 Java 登录可用，`/api/v1/buyer/workspace` 返回真实数据。
- 本地数据快照：采购需求 53 条、询价项目 51 条、采购订单 49 条、发票 48 张、付款批次 14 个。
- `/api/v1/buyer/payment-block-resolutions` 已可通过 smoke/视觉脚本创建或更新样本记录，付款批次详情中的处理记录台账应展示非空回显。

## 视觉验收结果

- 桌面 1280x720：已生成 `docs/artifacts/stage-four-java-desktop-1280x720.png`。
- 移动 390x844：已生成 `docs/artifacts/stage-four-java-mobile-390x844.png`。
- DOM 检查：包含 `Java 数据源`、`发票付款`、`付款批次详情`、`归档审计面板`、`审计追踪入口`、`处理记录台账`、`Java visual smoke 阻断处理记录`。
- 本轮脚本输出 `hasArchiveAuditPanel: true`、`hasArchiveAuditHandoff: true`，并记录 `failed: []`。
- 失败信号检查：无加载失败、无 `Failed to fetch`、无 `argument type mismatch`、无 React runtime error。
- 移动截图未见整页横向溢出；该项同时由 `scripts/mobile-layout-overflow-ui.test.ts` 的静态布局契约继续兜底。

## 工具情况

- `scripts/stage-four-java-visual-check.mjs` 已改为 Chrome CLI 截图 + `--dump-dom` 文本检查，不再依赖不稳定的 Chrome DevTools 调试端口。
- 脚本输出 `docs/artifacts/stage-four-java-visual-check-result.json`，记录桌面/移动截图路径、seededResolution、DOM 检查结果和失败信号。
- 当前 macOS 环境下 Chrome CLI 会在写出截图后继续驻留，脚本通过超时强制回收进程；这不影响截图和 DOM 结果，但仍作为工具行为边界保留。

## 后续动作

下一轮可以继续推进三单匹配、对账差异处理和付款计划的联动增强；付款阻断处理记录本轮已经具备 Java API 样本生成、更新、查询和页面非空回显验收。
