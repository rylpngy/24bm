import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin list toolbar UI', () => {
  it('uses a shared toolbar for high-frequency admin lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('const ListToolbar');
    expect(app).toContain('recordCount: number');
    expect(app).toContain('filterLabel: string');
    expect(app).toContain('actionLabel?: string');
    expect(app).toContain('共 {recordCount} 条');
    expect(app).toContain('当前筛选：{filterLabel}');
    expect(app).toContain('<Search size={16}');
  });

  it('adds list toolbar context to buyer demand, platform tenant, and supplier opportunity lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('title="需求池"');
    expect(app).toContain('recordCount={filteredDemandListRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '全部需求状态'}");
    expect(app).toContain('actionLabel="新建需求"');

    expect(app).toContain('title="租户运营列表"');
    expect(app).toContain('recordCount={platformTenants.length}');
    expect(app).toContain('filterLabel="全部采购企业租户"');
    expect(app).toContain('actionLabel="租户配置"');

    expect(app).toContain('title="询价邀请池"');
    expect(app).toContain('recordCount={workspace.opportunities.length}');
    expect(app).toContain('filterLabel="待报价优先"');
    expect(app).toContain('actionLabel="批量响应预留"');
  });

  it('adds list toolbar context to remaining buyer workflow lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('title="询价项目池"');
    expect(app).toContain('const rfqListRows = buildRfqListRows(workspace);');
    expect(app).toContain('recordCount={filteredRfqListRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '全部询价状态'}");
    expect(app).toContain('actionLabel="邀请供应商"');

    expect(app).toContain('title="比价定标池"');
    expect(app).toContain('recordCount={filteredQuoteRfqs.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '按询价项目聚合'}");
    expect(app).toContain('actionLabel="提交定标审批"');

    expect(app).toContain('title="订单履约池"');
    expect(app).toContain('recordCount={filteredOrderFulfillmentRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '全部订单状态'}");
    expect(app).toContain('actionLabel="生成订单"');

    expect(app).toContain('title="收货验收池"');
    expect(app).toContain('recordCount={filteredReceiptInspectionRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '待收货优先'}");
    expect(app).toContain('actionLabel="登记收货"');

    expect(app).toContain('title="发票付款池"');
    expect(app).toContain('recordCount={filteredInvoicePaymentRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '待付款优先'}");
    expect(app).toContain('actionLabel="登记付款"');

    expect(app).toContain('title="操作审计池"');
    expect(app).toContain('recordCount={filteredLogs.length}');
    expect(app).toContain("filterLabel={normalizedSearchQuery ? `搜索匹配：${searchQuery.trim()}` : '最近操作优先'}");
    expect(app).toContain('actionLabel="导出预留"');
  });

  it('adds list toolbar context to buyer information management lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('title="审批待办池"');
    expect(app).toContain('recordCount={filteredApprovalQueueRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '待审批优先'}");
    expect(app).toContain('actionLabel="批量审批预留"');

    expect(app).toContain('title="审批记录池"');
    expect(app).toContain('recordCount={filteredRecentApprovals.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '最近处理优先'}");
    expect(app).toContain('actionLabel="审批模板"');

    expect(app).toContain('title="私域供应商池"');
    expect(app).toContain('recordCount={filteredSupplierRelationRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '全部合作状态'}");
    expect(app).toContain('actionLabel="供应商准入"');

    expect(app).toContain('title="物料服务池"');
    expect(app).toContain('recordCount={filteredMaterialRows.length}');
    expect(app).toContain("filterLabel={searchFilterLabel ?? '全部物料品类'}");
    expect(app).toContain('actionLabel="新增物料"');
  });
});
