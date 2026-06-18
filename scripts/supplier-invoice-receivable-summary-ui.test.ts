import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier invoice receivable summary UI', () => {
  it('summarizes receivable status and next action on the supplier invoice page', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('SupplierInvoiceReceivableSummaryPanel');
    expect(supplierWorkspace).toContain('应收摘要');
    expect(supplierWorkspace).toContain('应收总额');
    expect(supplierWorkspace).toContain('待回款');
    expect(supplierWorkspace).toContain('已回款');
    expect(supplierWorkspace).toContain('发票数量');
    expect(supplierWorkspace).toContain('下一步');
    expect(supplierWorkspace).toContain("invoice.paymentStatus !== '已付款'");
    expect(supplierWorkspace).toContain("invoices.reduce");
  });
});
