import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer receipt detail UI', () => {
  it('connects receipt inspection selections to a receipt detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const receiptDetailView = app.slice(
      app.indexOf('const ReceiptInspectionDetailPanelView'),
      app.indexOf('const InvoicePaymentDetailPanelView'),
    );

    expect(buyerAdminUi).toContain('buildReceiptInspectionDetailPanel');
    expect(buyerAdminUi).toContain('logisticsFacts');
    expect(buyerAdminUi).toContain('acceptanceChecks');
    expect(buyerAdminUi).toContain('postReceiptRows');
    expect(buyerAdminUi).toContain('relatedRows');

    expect(app).toContain('buildReceiptInspectionDetailPanel');
    expect(app).toContain('selectedReceiptOrderId');
    expect(app).toContain('setSelectedReceiptOrderId');
    expect(app).toContain('ReceiptInspectionDetailPanelView');
    expect(receiptDetailView).toContain('验收详情');
    expect(receiptDetailView).toContain('物流信息');
    expect(receiptDetailView).toContain('验收检查');
    expect(receiptDetailView).toContain('后续协同');
    expect(receiptDetailView).toContain('postReceiptRows');
    expect(receiptDetailView).toContain('关联业务');
  });

  it('surfaces receipt registration actions inside the detail panel', () => {
    const app = read('App.tsx');
    const receiptDetailView = app.slice(
      app.indexOf('const ReceiptInspectionDetailPanelView'),
      app.indexOf('const InvoicePaymentDetailPanelView'),
    );

    expect(receiptDetailView).toContain('ReceiptInspectionOperationPanel');
    expect(receiptDetailView).toContain('验收操作');
    expect(receiptDetailView).toContain('order?: BuyerWorkspace[\'orders\'][number]');
    expect(receiptDetailView).toContain('busy: boolean');
    expect(receiptDetailView).toContain('javaEnabled: boolean');
    expect(receiptDetailView).toContain('receiptDraft?: BuyerReceiptDraft');
    expect(receiptDetailView).toContain('onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void');
    expect(app).toContain('order={selectedReceiptOrderRecord}');
    expect(app).toContain('busy={buyerFulfillmentBusyId === `receipt:${selectedReceiptOrder}`}');
    expect(app).toContain('onCreateReceipt={onCreateReceipt}');
  });
});
