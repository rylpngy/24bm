import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer fulfillment action forms UI', () => {
  it('collects receipt and payment inputs before calling buyer fulfillment actions', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );

    expect(app).toContain('type BuyerReceiptDraft');
    expect(app).toContain('type BuyerPaymentDraft');
    expect(app).toContain('createBuyerReceiptFromOrder = async (orderId: string, draft: BuyerReceiptDraft)');
    expect(app).toContain('registerBuyerInvoicePayment = async (invoiceId: string, draft: BuyerPaymentDraft)');
    expect(app).toContain('result: draft.result');
    expect(app).toContain('paymentStatus: draft.paymentStatus');
    expect(buyerWorkspace).toContain('receiptDrafts');
    expect(buyerWorkspace).toContain('paymentDrafts');
    expect(buyerWorkspace).toContain('验收结果');
    expect(buyerWorkspace).toContain('付款状态');
    expect(buyerWorkspace).toContain('onCreateReceipt(orderRow.id, receiptDraft)');
    expect(buyerWorkspace).toContain('onRegisterPayment(invoiceRow.id, paymentDraft)');
  });

  it('keeps inline receipt and payment quick actions from overwriting draft details', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );

    expect(buyerWorkspace).toContain('updateReceiptDraft(orderRow.id, { result: event.target.value })');
    expect(buyerWorkspace).toContain('updatePaymentDraft(invoiceRow.id, { paymentStatus: event.target.value })');
    expect(buyerWorkspace).not.toContain('[orderRow.id]: { result: event.target.value }');
    expect(buyerWorkspace).not.toContain('[invoiceRow.id]: { paymentStatus: event.target.value }');
  });

  it('shows validation feedback and applies full draft rules before fulfillment submissions', () => {
    const app = read('App.tsx');
    const receiptForm = app.slice(
      app.indexOf('const ReceiptRegistrationForm'),
      app.indexOf('const PaymentRegistrationForm'),
    );
    const paymentForm = app.slice(
      app.indexOf('const PaymentRegistrationForm'),
      app.indexOf('const OrderDetailPanelView'),
    );
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );

    expect(receiptForm).toContain('receiptRemarkInvalid');
    expect(receiptForm).toContain('receiptExceptionInvalid');
    expect(receiptForm).toContain('请填写验收备注后再登记收货。');
    expect(receiptForm).toContain('异常待处理时必须填写异常原因。');
    expect(receiptForm).toContain('aria-live="polite"');
    expect(paymentForm).toContain('paymentRemarkInvalid');
    expect(paymentForm).toContain('paymentReconciliationInvalid');
    expect(paymentForm).toContain('请填写付款备注后再登记付款。');
    expect(paymentForm).toContain('请填写对账说明后再登记付款。');
    expect(paymentForm).toContain('aria-live="polite"');
    expect(buyerWorkspace).toContain('receiptDraftInvalid');
    expect(buyerWorkspace).toContain('paymentDraftInvalid');
    expect(buyerWorkspace).toContain('disabled={receiptBusy || receiptDraftInvalid}');
    expect(buyerWorkspace).toContain('disabled={paymentBusy || paymentDraftInvalid}');
  });
});
