import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer invoice detail UI', () => {
  it('connects invoice payment selections to an invoice detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildInvoicePaymentDetailPanel');
    expect(buyerAdminUi).toContain('orderFacts');
    expect(buyerAdminUi).toContain('relatedRows');
    expect(buyerAdminUi).toContain('paymentTimelineRows');

    expect(app).toContain('buildInvoicePaymentDetailPanel');
    expect(app).toContain('selectedInvoiceId');
    expect(app).toContain('setSelectedInvoiceId');
    expect(app).toContain('InvoicePaymentDetailPanelView');
    expect(app).toContain('发票详情');
    expect(app).toContain('订单上下文');
    expect(app).toContain('关联业务');
    expect(app).toContain('付款轨迹');
  });
});
