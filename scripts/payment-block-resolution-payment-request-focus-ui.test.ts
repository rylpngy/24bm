import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution payment request focus UI', () => {
  it('highlights the focused payment request after using the review action locator', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('focusedPaymentRequestId');
    expect(ledgerPanel).toContain('setFocusedPaymentRequestId(row.reviewTargetPaymentRequestId)');
    expect(ledgerPanel).toContain('待复核付款申请定位');
    expect(ledgerPanel).toContain('当前定位');
    expect(ledgerPanel).toContain("focusedPaymentRequestId === request.id");
    expect(ledgerPanel).toContain('border-amber-400 bg-amber-50');
  });

  it('records the sixty fourth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 64 | 付款申请复核定位反馈 |');
    expect(checklist).toContain('scripts/payment-block-resolution-payment-request-focus-ui.test.ts');
    expect(checklist).toContain('待复核付款申请定位');
  });
});
