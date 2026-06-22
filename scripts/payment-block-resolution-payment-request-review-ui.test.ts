import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution payment request review UI', () => {
  it('shows pending payment request count and can select the first pending payment request invoice from review actions', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchPendingPaymentRequestRows');
    expect(ledgerPanel).toContain('selectedPaymentBatchPendingPaymentRequestCount');
    expect(ledgerPanel).toContain('reviewTargetPaymentRequestInvoiceId');
    expect(ledgerPanel).toContain('待复核付款申请');
    expect(ledgerPanel).toContain('定位付款申请');
    expect(ledgerPanel).toContain('onSelectInvoiceForReview(row.reviewTargetPaymentRequestInvoiceId)');
  });

  it('records the sixty third stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 63 | 付款申请复核定位 |');
    expect(checklist).toContain('scripts/payment-block-resolution-payment-request-review-ui.test.ts');
    expect(checklist).toContain('待复核付款申请');
  });
});
