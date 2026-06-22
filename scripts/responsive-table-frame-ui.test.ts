import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('responsive table frame UI', () => {
  it('defines a shared frame with mobile cards and desktop table regions', () => {
    const app = read('App.tsx');

    expect(app).toContain('const ResponsiveTableFrame');
    expect(app).toContain('mobileCards: React.ReactNode;');
    expect(app).toContain('children: React.ReactNode;');
    expect(app).toContain('className="grid gap-3 lg:hidden"');
    expect(app).toContain('className="hidden overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white shadow-sm lg:block"');
    expect(app).toContain('className="min-w-max"');
  });

  it('uses mobile summary cards for tenant and RFQ tables', () => {
    const app = read('App.tsx');
    const tenantList = app.slice(
      app.indexOf('<Panel title="租户列表"'),
      app.indexOf('{activeModule === \'reviews\''),
    );
    const rfqList = app.slice(
      app.indexOf('<Panel title="询价项目"'),
      app.indexOf('<RfqDetailPanelView'),
    );

    expect(tenantList).toContain('<ResponsiveTableFrame');
    expect(tenantList).toContain('mobileCards={platformTenants.map((tenant) => (');
    expect(tenantList).toContain('<ResponsiveSummaryCard');
    expect(tenantList).toContain('ariaLabel={`${tenant.name} 租户摘要`}');
    expect(tenantList).toContain('功能开关');

    expect(rfqList).toContain('<ResponsiveTableFrame');
    expect(rfqList).toContain('mobileCards={displayedRfqListRows.map((rfq) => (');
    expect(rfqList).toContain('<ResponsiveSummaryCard');
    expect(rfqList).toContain('ariaLabel={`${rfq.title} 询价摘要`}');
    expect(rfqList).toContain('detailButton="table"');
  });
});
