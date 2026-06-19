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

  it('surfaces buyer fulfillment actions inside the order detail panel', () => {
    const app = read('App.tsx');
    const orderDetailView = app.slice(
      app.indexOf('const OrderDetailPanelView'),
      app.indexOf('const ReceiptInspectionDetailPanelView'),
    );

    expect(orderDetailView).toContain('OrderDetailOperationPanel');
    expect(orderDetailView).toContain('订单操作');
    expect(orderDetailView).toContain('order?: BuyerWorkspace[\'orders\'][number]');
    expect(orderDetailView).toContain('javaEnabled: boolean');
    expect(orderDetailView).toContain('buyerFulfillmentBusyId: string | null');
    expect(orderDetailView).toContain('receiptDraft?: BuyerReceiptDraft');
    expect(orderDetailView).toContain('onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void');
    expect(app).toContain('order={selectedOrderRecord}');
    expect(app).toContain('buyerFulfillmentBusyId={buyerFulfillmentBusyId}');
    expect(app).toContain('onCreateReceipt={onCreateReceipt}');
  });

  it('places logistics, invoice, and next action summary in the top order detail card', () => {
    const app = read('App.tsx');
    const orderDetailView = app.slice(
      app.indexOf('const OrderDetailPanelView'),
      app.indexOf('const OrderDetailOperationPanel'),
    );
    const topCard = orderDetailView.slice(
      orderDetailView.indexOf('<DetailHeroCard'),
      orderDetailView.indexOf('<section>'),
    );

    expect(orderDetailView).toContain('const logisticsStatus = detail?.facts.find((fact) => fact.label === \'物流状态\')?.value ?? \'待发货\';');
    expect(orderDetailView).toContain('const invoicePaymentStatus = detail?.facts.find((fact) => fact.label === \'发票状态\')?.value ?? \'待开票\';');
    expect(topCard).toContain('summaryFacts={[');
    expect(topCard).toContain("{ label: '物流状态', value: logisticsStatus }");
    expect(topCard).toContain("{ label: '发票付款', value: invoicePaymentStatus }");
    expect(topCard).toContain("{ label: '下一步', value: detail.nextActionTitle }");
  });
});
