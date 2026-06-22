import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer receipt operation panel UI details', () => {
  it('summarizes receipt context beside registration actions', () => {
    const app = read('App.tsx');
    const receiptOperationPanel = app.slice(
      app.indexOf('const ReceiptInspectionOperationPanel'),
      app.indexOf('const InvoicePaymentDetailPanelView'),
    );

    expect(receiptOperationPanel).toContain('验收摘要');
    expect(receiptOperationPanel).toContain('供应商');
    expect(receiptOperationPanel).toContain('订单金额');
    expect(receiptOperationPanel).toContain('预计到货');
    expect(receiptOperationPanel).toContain('物流单号');
    expect(receiptOperationPanel).toContain('发票状态');
    expect(receiptOperationPanel).toContain('detail.facts.find');
    expect(receiptOperationPanel).toContain('detail.logisticsFacts.find');
    expect(receiptOperationPanel).toContain('renderReceiptSummary');
    expect(receiptOperationPanel.indexOf('const renderReceiptSummary')).toBeLessThan(
      receiptOperationPanel.indexOf('if (!javaEnabled)'),
    );
  });
});
