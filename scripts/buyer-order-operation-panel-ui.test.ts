import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer order operation panel UI details', () => {
  it('summarizes fulfillment context beside buyer order actions', () => {
    const app = read('App.tsx');
    const orderOperationPanel = app.slice(
      app.indexOf('const OrderDetailOperationPanel'),
      app.indexOf('const ReceiptInspectionDetailPanelView'),
    );

    expect(orderOperationPanel).toContain('履约摘要');
    expect(orderOperationPanel).toContain('供应商');
    expect(orderOperationPanel).toContain('订单金额');
    expect(orderOperationPanel).toContain('预计到货');
    expect(orderOperationPanel).toContain('物流状态');
    expect(orderOperationPanel).toContain('发票付款');
    expect(orderOperationPanel).toContain('detail.amountLabel');
    expect(orderOperationPanel).toContain('detail.supplierName');
    expect(orderOperationPanel).toContain('detail.facts.find');
    expect(orderOperationPanel).toContain('renderFulfillmentSummary');
    expect(orderOperationPanel.indexOf('const renderFulfillmentSummary')).toBeLessThan(
      orderOperationPanel.indexOf('if (!javaEnabled)'),
    );
  });
});
