# 24Bid 轻量化标准 SRM 需求设计

> 生成时间：2026-06-24
> 定位：把现有散落的供应商能力（私域库 + 档案 + 交易协同）收敛为一个**轻量化标准 SRM 治理闭环**，可完成基础闭环，预留扩展。
> 配套：`docs/产品需求理解.md`（整体需求）、`docs/后续研发路线.md`（重写路线）。
> 本轮已定 scoping：① 绩效=多维人工录入+周期+驱动调级；② 引入=采购方录入 + 供应商自助注册入驻；③ 分级=保留 A/B/C 等级 + 加生命周期标记。

## 1. SRM 生命周期闭环（目标态）

```
                       ┌──────────── 供应商自助注册入驻 ───────────┐
                       ▼                                          │
潜在 → 注册/引入 → 准入审核 → 合格 →  分级分类  →  周期绩效考核  →  驱动调级
                       ▲          (等级A/B/C +      (多维人工录入)    (优选/合格/
                       │         生命周期标记)            │          观察/淘汰)
              采购方主动录入/邀请                          └── 绩效驱动生命周期标记（闭环核心）──┘
                                                                          │
                                                              淘汰/严重违规 → 退出 / 黑名单
```

**闭环核心**：周期绩效考核 → 综合评分 → 建议生命周期标记 → 采购方确认调级 → 影响询价邀请资格，形成"考核驱动治理"的回路。

## 2. 三个正交维度（避免状态混淆）

供应商在采购方私域库里同时有三个独立维度，**不可混为一谈**：

| 维度 | 取值 | 含义 | 来源 |
|---|---|---|---|
| **准入状态** (admission) | 潜在 / 待准入 / 准入审批中 / 已准入 / 已驳回 / 已退出 / 黑名单 | 进入私域库的门禁生命周期 | 现有 `BuyerSupplierRelation.status` 扩展（加"潜在/已退出"） |
| **能力等级** (level) | A / B / C | 综合能力分档 | 现有，保留 |
| **生命周期标记** (cooperationTier) | 优选 / 合格 / 观察 / 淘汰 | 当前合作健康度，**绩效驱动** | 🆕 新增字段 |

> 区分：**黑名单** = 严重违规、禁止一切合作（准入终态）；**淘汰** = 绩效不达标、停止新业务但非黑名单（生命周期标记）；**已退出** = 合作正常结束。

## 3. 五大能力域与 MVP 边界

### 3.1 供应商档案（主数据）—— 现有，轻补
- 企业基础信息、信用代码、法人、联系人、银行账户、品类。
- MVP：沿用现有 `SupplierProfile`/`Enterprise`，补"联系人 + 银行账户"两组字段。

### 3.2 准入管理 —— 现有 + 🆕 自助注册入驻
两条引入路径汇入同一"待准入"队列：
- **路径 A（现有）**：采购方在私域库主动录入/邀请 → 待准入。
- **路径 B（🆕 MVP 新增）**：供应商自助注册入驻
  1. 供应商自助注册平台企业账号 → 填报档案 + 资质 → 平台企业审核（复用 `PlatformEnterpriseController` 雏形）。
  2. 已认证供应商向指定采购方发起"加入私域库"申请 → 进入该采购方"待准入"队列。
  3. 采购方走现有准入审批（`TPL_SUPPLIER_ADMISSION`）→ 已准入/驳回。

### 3.3 分类分级 —— 现有等级 + 🆕 生命周期标记
- **等级 A/B/C**：保留，采购方手动设定（能力定位）。
- **生命周期标记**：🆕 优选/合格/观察/淘汰，由绩效考核**建议**、采购方**确认**后写入。
- 品类授权（categories）：保留，决定该供应商可参与哪些品类的 RFQ。

### 3.4 资质证照 —— 现有 + 🆕 到期预警
- 现有：`SupplierQualification`（类型、证书号、`expiresAt`、附件、状态）。
- 🆕 MVP：用好 `expiresAt`——到期前 N 天（默认 30）生成预警：
  - 站内通知供应商 + 采购方；
  - 供应商库列表标记"即将到期/已过期"；
  - **过期资质 → 该品类下不可被邀请 RFQ**（扩展现有 active 资质校验为"有效且未过期"）。

### 3.5 绩效考核 —— 🆕 核心闭环（MVP）
**多维人工录入 + 周期 + 驱动调级**：

- **考核维度（默认 4 维）**：

  | 维度 | 默认权重 | 录入方式 |
  |---|---|---|
  | 质量 quality | 35% | 人工 0–100 |
  | 交付 delivery | 30% | 人工 0–100 |
  | 价格 price | 20% | 人工 0–100 |
  | 服务/配合 service | 15% | 人工 0–100 |

- **综合分** = Σ(维度分 × 权重)。
- **考核周期**：季度 / 年度（评估单带周期标识，如 `2026-Q2`）；同一供应商同一周期只能一份生效评估（唯一约束）。
- **评估单状态**：草稿 → 已提交 →（可选审批）→ 已生效。
- **驱动调级规则**（阈值 MVP 写默认、预留可配置）：

  | 综合分 | 建议生命周期标记 |
  |---|---|
  | ≥ 90 | 优选 |
  | 75–90 | 合格 |
  | 60–75 | 观察 |
  | < 60 | 淘汰 |

- **调级是"建议"**：评估生效后给出建议标记，**采购方手动确认**才写入 `cooperationTier`（保留人控权，符合轻量原则）。
- 供应商侧可查看自己的考核结果（透明化），但不可修改。

## 4. 新增/扩展的领域实体

```
BuyerSupplierRelation（扩展）
  + cooperationTier: 优选|合格|观察|淘汰   // 生命周期标记
  + lastEvaluationScore: number            // 最近综合分
  + lastEvaluatedAt: date
  + admissionSource: buyer_entry|supplier_apply  // 引入来源
  status 增加: 潜在 / 已退出

SupplierEvaluation（🆕 绩效考核单）
  id, tenantId, supplierId, period(2026-Q2|2026),
  qualityScore, deliveryScore, priceScore, serviceScore,
  weightsJson, totalScore, suggestedTier,
  status(草稿|已提交|已生效), evaluatedBy, comment,
  createdAt, updatedAt
  唯一约束: (tenant_id, supplier_id, period) 一周期一生效评估

SupplierAdmissionApplication（🆕 自助入驻申请，或复用 BuyerSupplierRelation）
  id, supplierId, targetTenantId, status, submittedDataJson, createdAt

SupplierQualification（扩展使用）
  用好 expiresAt；🆕 派生 alertStatus: 正常|即将到期|已过期
```

## 5. 新增 API（高层，沿 `/api/v1` + 租户头）

**采购方侧**
```
GET    /buyer/suppliers/{id}/evaluations          某供应商历史考核
POST   /buyer/suppliers/{id}/evaluations          新建/提交考核单
POST   /buyer/supplier-evaluations/{evalId}/finalize   评估生效→产出建议标记
POST   /buyer/suppliers/{id}/tier                 采购方确认生命周期标记调整
GET    /buyer/supplier-qualification-alerts       资质到期预警列表
POST   /buyer/admission-applications/{id}/review  审核供应商自助入驻申请
```
**供应商侧**
```
POST   /supplier/register                         自助注册（或平台层）
POST   /supplier/admission-applications           向采购方发起加入申请
GET    /supplier/evaluations                      查看自己的考核结果
GET    /supplier/qualification-alerts             自己的资质到期提醒
```
**复用现有**：准入审批 `TPL_SUPPLIER_ADMISSION`、站内通知、审计、附件（资质文件）。

## 6. 与采购主流程的集成点

- **RFQ 邀请资格**：扩展现有校验为「已准入 + 品类有效资质未过期 + 生命周期标记 ≠ 淘汰 + 非黑名单」。
- **绩效自动取数（扩展项，不在 MVP）**：后续可从 `deliveries` 算准时交付率、`receipts` 算质量合格率、`invoices/payments` 算对账及时率，自动回填考核维度。
- **审计/通知**：考核生效、调级、入驻审核、资质预警均写审计 + 发通知。

## 7. 前端（复刻现有样式）

新增页面/区块全部用现有组件库与配色：
- **供应商库列表**：在现有 `*ListRowCard` 上补「生命周期标记」`StatusPill`（优选→emerald、合格→blue、观察→amber、淘汰→slate）、「资质到期」红色角标。
- **供应商详情页**：在现有 `DetailHeroCard` + `DetailSection` 结构上加「绩效考核」分区（雷达/多维条 + 历史考核 `ResponsiveTableFrame`）、「资质证照」分区（含到期状态）。
- **考核录入表单**：复用现有表单样式（4 维 0–100 输入 + 实时综合分 + 建议标记预览 + `PrimaryActionButton` 提交）。
- **供应商自助入驻**：供应商端新增注册/申请页，沿用顶栏+卡片表单风格。
- **资质预警**：列表 `ListToolbar` + 预警卡片（`ProcessStateNotice` 的 blocked/waiting 态）。

## 8. MVP 完成定义（基础闭环）

一条端到端可验收的 SRM 闭环：
1. 供应商自助注册入驻 → 平台审核 → 向采购方申请加入 → 采购方准入。
2. 采购方设等级 A/B/C + 品类授权 + 登记资质（含有效期）。
3. 按季度对供应商做多维绩效考核 → 综合分 → 建议生命周期标记 → 采购方确认调级。
4. 资质临近到期触发预警；过期后该品类不可被邀请 RFQ。
5. 淘汰/黑名单供应商被 RFQ 邀请校验拦截。
6. 全程审计 + 通知；供应商可见自己的考核与预警。

## 9. 扩展路线（如有需求再拓展）

- **绩效自动取数**：客观指标从订单/收货/发票自动计算。
- **绩效权重模板可配置**：不同品类不同权重，按租户配置。
- **风险画像**：黑名单外的中间风险态、外部数据（工商/司法/舆情）接入与预警。
- **寻源推荐**：基于绩效与品类的供应商推荐、公共供应商市场。
- **SCAR 纠正措施**：考核不合格触发整改单跟踪闭环。
- **供应商门户增强**：协同沟通、对账自助、绩效申诉。
