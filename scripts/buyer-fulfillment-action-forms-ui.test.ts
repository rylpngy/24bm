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
});
