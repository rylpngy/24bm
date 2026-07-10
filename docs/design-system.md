# 24Bid 前端设计系统 · 列表页体验规约

三端(采购方 / 平台 / 供应商)所有列表页遵循同一套规约,组件原语统一在 `@24bid/ui`。

## 一、可复用原语(`@24bid/ui`)

| 原语 | 用途 |
|---|---|
| `Panel` | 标准模块面板(图标 + 标题 + 副标题 + 内容) |
| `MiniFact` | KPI 统计卡(label + value) |
| `CountTag` | 工具条统计胶囊(「共 N 条」「队列 N 家」),灰底描边 |
| `SearchInput` | 列表搜索框(输入 + 搜索按钮 + 清除,自管输入态,提交回调已 trim) |
| `Tabs` | 横向标签(模块二级导航 / 详情 360 Tab) |
| `Pagination` | 分页条(计数 + 区间 + 上/下一页,受控、1 基页码) |
| `StatusPill` | 状态徽标 |
| `Detail*` | 详情页:`DetailHeroCard` / `DetailSection` / `DetailActionPanel` / `DetailKeyValueRow` |

> ❌ 已删除的 `ListToolbar`(纯装饰研发提示卡)——禁止再引入此类无 onClick 的"假按钮"提示。

## 二、列表页结构(自上而下)

```
<Panel title=... icon=... subtitle=...>
  1. KPI 条(可选):<div className="mb-4 grid gap-2 sm:grid-cols-N"> <MiniFact .../> </div>
  2. 工具条(一行):见下
  3. 创建表单(可选,showForm 折叠)
  4. 列表 / 表格(分页切片 pageItems,表格含「序号」列)
  5. <Pagination .../>
</Panel>
```

## 三、统一工具条(一行 `flex flex-wrap items-center gap-2`)

- **左**:筛选 chips(状态/等级等)或 `CountTag` 统计标签。
- **右**(`ml-auto`):`SearchInput` + 主操作按钮。
- 无筛选的页:左侧放 `CountTag`,右侧搜索(搜索不再独占一行)。
- 任一筛选/搜索变化 → `setPage(1)` 回到第一页。

```tsx
<div className="mb-4 flex flex-wrap items-center gap-2">
  <div className="flex flex-wrap gap-2">{statusChips}</div>{/* 或 <CountTag> */}
  <SearchInput className="mb-0 ml-auto" placeholder="…" onSearch={(k)=>{setKeyword(k);setPage(1)}} />
  {addButton}
</div>
```

## 四、按钮配色

| 语义 | 配色 | 高度 |
|---|---|---|
| 搜索 | `bg-blue-600 hover:bg-blue-700`(蓝) | h-8 |
| **新增 / 创建 / 发起 / 发布 / 设置 / 添加**(列表主操作) | `bg-slate-900 hover:bg-slate-800`(深色,圆角 rounded-lg) | h-9 |
| 行内业务动作(提交审批/提交验收/通过) | 蓝 `bg-blue-600`;通过=绿、驳回/拉黑=红 | h-8 |
| 次要 / 取消 / 清除 | 白底描边 `border-slate-200 bg-white` | h-8 |

## 五、分页与序号

- 每页 `PAGE_SIZE = 8`(报价对比因卡片高用 5)。
- 表格首列「序号」、卡片标题前缀序号:`(safePage - 1) * PAGE_SIZE + i + 1`,跨页连续。

## 六、详情范式

列表行点击 → 钻取 `DetailHeroCard + Tabs` 360 详情(`onBack` 返回);父组件用最新列表数据回灌选中项(动作后状态即时刷新)。跨实体聚合页(如资质管理)用"每行子组件各取 per-id 数据"。
