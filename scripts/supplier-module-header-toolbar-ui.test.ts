import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier module header and toolbar UI', () => {
  it('adds a shared supplier module header to supplier workspace pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('const SupplierModuleHeader');
    expect(app).toContain('const supplierModuleHeaders: Record<SupplierAdminModule');
    expect(app).toContain('const supplierModuleFacts = buildSupplierModuleFacts(workspace, activeModule)');
    expect(app).toContain('const supplierModuleHeader = supplierModuleHeaders[activeModule]');
    expect(app).toContain('<SupplierModuleHeader');
    expect(app).toContain('header={supplierModuleHeader}');
    expect(app).toContain('供应商当前动作');
    expect(app).toContain('当前筛选');
  });

  it('surfaces module-specific supplier copy for opportunities, quotes, orders, invoices, and profile', () => {
    const app = read('App.tsx');

    expect(app).toContain("opportunities: {");
    expect(app).toContain("title: '询价邀请'");
    expect(app).toContain("primaryAction: '提交报价 / 查看要求'");
    expect(app).toContain("quotes: {");
    expect(app).toContain("primaryAction: '跟进定标结果'");
    expect(app).toContain("orders: {");
    expect(app).toContain("primaryAction: '确认订单 / 提交发货'");
    expect(app).toContain("invoices: {");
    expect(app).toContain("primaryAction: '跟进回款状态'");
    expect(app).toContain("profile: {");
    expect(app).toContain("primaryAction: '维护企业档案'");
  });

  it('adds list toolbar context to supplier quote, order, and invoice lists', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('title="报价记录池"');
    expect(supplierWorkspace).toContain('recordCount={workspace.quotes.length}');
    expect(supplierWorkspace).toContain('filterLabel="按询价项目聚合"');
    expect(supplierWorkspace).toContain('actionLabel="跟进定标"');

    expect(supplierWorkspace).toContain('title="销售订单池"');
    expect(supplierWorkspace).toContain('recordCount={workspace.orders.length}');
    expect(supplierWorkspace).toContain('filterLabel="待处理优先"');
    expect(supplierWorkspace).toContain('actionLabel="批量履约预留"');

    expect(supplierWorkspace).toContain('title="发票应收池"');
    expect(supplierWorkspace).toContain('recordCount={workspace.invoices.length}');
    expect(supplierWorkspace).toContain('filterLabel="待回款优先"');
    expect(supplierWorkspace).toContain('actionLabel="对账预留"');
  });
});
