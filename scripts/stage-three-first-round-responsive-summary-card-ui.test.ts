import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage three first round responsive summary card UI', () => {
  it('defines a shared responsive summary card for mobile list rows', () => {
    const app = read('App.tsx');

    expect(app).toContain('const ResponsiveSummaryCard');
    expect(app).toContain('ariaLabel: string;');
    expect(app).toContain("facts?: Array<{ label: string; value: string }>;");
    expect(app).toContain("detailButton?: 'detail' | 'table';");
    expect(app).toContain('aria-label={ariaLabel}');
    expect(app).toContain('focus-within:ring-2 focus-within:ring-blue-100');
    expect(app).toContain('hover:border-blue-200 hover:shadow-sm');
    expect(app).toContain('className="min-w-0 max-w-full"');
    expect(app).toContain('className="mt-3 grid gap-2 sm:grid-cols-2"');
    expect(app).toContain('<TableDetailButton');
    expect(app).toContain('<DetailToggleButton');
  });

  it('uses the shared card for tenant, RFQ, and reconciliation mobile summaries', () => {
    const app = read('App.tsx');
    const tenantList = app.slice(
      app.indexOf('<Panel title="租户列表"'),
      app.indexOf("{activeModule === 'reviews'"),
    );
    const rfqList = app.slice(
      app.indexOf('<Panel title="询价项目"'),
      app.indexOf('<RfqDetailPanelView'),
    );
    const reconciliationPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(tenantList).toContain('<ResponsiveSummaryCard');
    expect(tenantList).toContain('ariaLabel={`${tenant.name} 租户摘要`}');
    expect(tenantList).toContain("detailButton=\"detail\"");

    expect(rfqList).toContain('<ResponsiveSummaryCard');
    expect(rfqList).toContain('ariaLabel={`${rfq.title} 询价摘要`}');
    expect(rfqList).toContain("detailButton=\"table\"");

    expect(reconciliationPanel).toContain('<ResponsiveSummaryCard');
    expect(reconciliationPanel).toContain('ariaLabel={`${invoice.reconciliationNo ?? `REC-${invoice.id}`} 对账单摘要`}');
    expect(reconciliationPanel).toContain('status={invoice.reconciliationStatus ?? \'待同步\'}');
  });
});
