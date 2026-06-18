import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer order detail UI', () => {
  it('connects order, receipt, and invoice views to an order detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildOrderDetailPanel');
    expect(buyerAdminUi).toContain('delivery');
    expect(buyerAdminUi).toContain('invoice');
    expect(buyerAdminUi).toContain('rfqLabel');

    expect(app).toContain('buildOrderDetailPanel');
    expect(app).toContain('selectedOrderId');
    expect(app).toContain('setSelectedOrderId');
    expect(app).toContain('OrderDetailPanelView');
    expect(app).toContain('订单详情');
    expect(app).toContain('物流信息');
    expect(app).toContain('发票付款');
    expect(app).toContain('查看详情');
  });
});
