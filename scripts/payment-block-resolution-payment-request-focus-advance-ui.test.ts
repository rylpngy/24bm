import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution payment request focus advance UI', () => {
  it('advances or clears the focused payment request after a focused request is approved', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('advanceFocusedPaymentRequestAfterStatusChange');
    expect(ledgerPanel).toContain("status === '付款申请已通过'");
    expect(ledgerPanel).toContain('selectedPaymentBatchPendingPaymentRequestRows.find((item) => item.id !== paymentRequestId)');
    expect(ledgerPanel).toContain('setFocusedPaymentRequestId(nextPendingRequest?.id ?? null)');
    expect(ledgerPanel).toContain('onSelectInvoiceForReview(nextPendingRequest.invoiceId)');
    expect(ledgerPanel).toContain('onUpdatePaymentRequestStatus(paymentRequestId, status)');
    expect(ledgerPanel).toContain("advanceFocusedPaymentRequestAfterStatusChange(request.id, '付款申请已通过')");
    expect(ledgerPanel).toContain('定位已推进');
  });

  it('records the sixty fifth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 65 | 付款申请复核定位推进 |');
    expect(checklist).toContain('scripts/payment-block-resolution-payment-request-focus-advance-ui.test.ts');
    expect(checklist).toContain('定位已推进');
  });
});
