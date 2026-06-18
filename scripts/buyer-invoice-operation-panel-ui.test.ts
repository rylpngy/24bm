import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer invoice operation panel UI details', () => {
  it('summarizes payment context beside payment registration actions', () => {
    const app = read('App.tsx');
    const invoiceOperationPanel = app.slice(
      app.indexOf('const InvoicePaymentOperationPanel'),
      app.indexOf('const SupplierDetailPanelView'),
    );

    expect(invoiceOperationPanel).toContain('付款摘要');
    expect(invoiceOperationPanel).toContain('供应商');
    expect(invoiceOperationPanel).toContain('关联订单');
    expect(invoiceOperationPanel).toContain('发票金额');
    expect(invoiceOperationPanel).toContain('订单金额');
    expect(invoiceOperationPanel).toContain('付款状态');
    expect(invoiceOperationPanel).toContain('detail.facts.find');
    expect(invoiceOperationPanel).toContain('detail.orderFacts.find');
    expect(invoiceOperationPanel).toContain('renderPaymentSummary');
    expect(invoiceOperationPanel.indexOf('const renderPaymentSummary')).toBeLessThan(
      invoiceOperationPanel.indexOf('return ('),
    );
  });
});
