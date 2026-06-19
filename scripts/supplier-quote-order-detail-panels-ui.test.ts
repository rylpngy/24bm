import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier quote and order detail panels UI', () => {
  it('adds selected quote and sales order detail panels with fulfillment context', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierProfileSummaryPanel'),
    );
    const quoteDetailPanel = app.slice(
      app.indexOf('const SupplierQuoteDetailPanel'),
      app.indexOf('const SupplierOrderFulfillmentDetailPanel'),
    );
    const orderDetailPanel = app.slice(
      app.indexOf('const SupplierOrderFulfillmentDetailPanel'),
      app.indexOf('const SupplierInvoiceReceivableSummaryPanel'),
    );

    expect(supplierWorkspace).toContain('selectedSupplierQuoteDetail');
    expect(supplierWorkspace).toContain('selectedSupplierOrderDetail');
    expect(supplierWorkspace).toContain('SupplierQuoteDetailPanel');
    expect(supplierWorkspace).toContain('SupplierOrderFulfillmentDetailPanel');
    expect(supplierWorkspace).toContain('lg:grid-cols-[minmax(0,1fr)_420px]');

    expect(quoteDetailPanel).toContain('报价详情');
    expect(quoteDetailPanel).toContain('关联询价');
    expect(quoteDetailPanel).toContain('定标结果');
    expect(quoteDetailPanel).toContain('报价附件');
    expect(quoteDetailPanel).toContain('下一步建议');
    expect(quoteDetailPanel).toContain('quote.rfqId');
    expect(quoteDetailPanel).toContain('rfq?.status');

    expect(orderDetailPanel).toContain('发货详情');
    expect(orderDetailPanel).toContain('销售订单详情');
    expect(orderDetailPanel).toContain('发票应收');
    expect(orderDetailPanel).toContain('履约轨迹');
    expect(orderDetailPanel).toContain('delivery?.trackingNo');
    expect(orderDetailPanel).toContain('invoice?.paymentStatus');
    expect(orderDetailPanel).toContain('order.expectedReceiptDate');
  });
});
