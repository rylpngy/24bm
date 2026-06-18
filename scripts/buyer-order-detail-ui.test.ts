import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer order detail UI', () => {
  it('connects order, receipt, and invoice views to an order detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const orderDetailView = app.slice(
      app.indexOf('const OrderDetailPanelView'),
      app.indexOf('const ReceiptInspectionDetailPanelView'),
    );

    expect(buyerAdminUi).toContain('buildOrderDetailPanel');
    expect(buyerAdminUi).toContain('delivery');
    expect(buyerAdminUi).toContain('invoice');
    expect(buyerAdminUi).toContain('rfqLabel');
    expect(buyerAdminUi).toContain('fulfillmentTimelineRows');
    expect(buyerAdminUi).toContain('fulfillmentCheckRows');
    expect(buyerAdminUi).toContain('relatedRows');

    expect(app).toContain('buildOrderDetailPanel');
    expect(app).toContain('selectedOrderId');
    expect(app).toContain('setSelectedOrderId');
    expect(app).toContain('OrderDetailPanelView');
    expect(orderDetailView).toContain('订单详情');
    expect(orderDetailView).toContain('物流信息');
    expect(orderDetailView).toContain('发票付款');
    expect(orderDetailView).toContain('履约检查');
    expect(orderDetailView).toContain('fulfillmentCheckRows');
    expect(orderDetailView).toContain('履约轨迹');
    expect(orderDetailView).toContain('关联业务');
    expect(app).toContain('查看详情');
  });
});
