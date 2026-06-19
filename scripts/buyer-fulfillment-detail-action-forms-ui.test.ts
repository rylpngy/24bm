import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer fulfillment detail action forms UI', () => {
  it('reuses receipt and payment drafts inside order, receipt, and invoice detail panels', () => {
    const app = read('App.tsx');
    const orderDetailView = app.slice(
      app.indexOf('const OrderDetailPanelView'),
      app.indexOf('const ReceiptInspectionDetailPanelView'),
    );
    const receiptDetailView = app.slice(
      app.indexOf('const ReceiptInspectionDetailPanelView'),
      app.indexOf('const InvoicePaymentDetailPanelView'),
    );
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const SupplierAdmissionForm'),
    );

    expect(app).toContain('ReceiptRegistrationForm');
    expect(app).toContain('PaymentRegistrationForm');
    expect(orderDetailView).toContain('receiptDraft?: BuyerReceiptDraft');
    expect(receiptDetailView).toContain('receiptDraft?: BuyerReceiptDraft');
    expect(invoiceDetailView).toContain('paymentDraft?: BuyerPaymentDraft');
    expect(app).toContain('验收结果');
    expect(app).toContain('receiptRemark');
    expect(app).toContain('exceptionReason');
    expect(app).toContain('attachmentNames');
    expect(app).toContain('验收备注');
    expect(app).toContain('异常原因');
    expect(app).toContain('附件清单');
    expect(app).toContain('差异处理提示');
    expect(app).toContain('付款状态');
    expect(orderDetailView).toContain('onCreateReceipt(order.id, receiptDraft)');
    expect(receiptDetailView).toContain('onCreateReceipt(detail.id, receiptDraft)');
    expect(invoiceDetailView).toContain('onRegisterPayment(detail.id, paymentDraft)');
  });
});
