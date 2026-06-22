import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch registration review summary UI', () => {
  it('summarizes post-registration review status at payment batch level', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchRegistrationReviewSummary');
    expect(ledgerPanel).toContain('selectedPaymentBatchRegistrationReviewNextStep');
    expect(ledgerPanel).toContain('登记后复核摘要');
    expect(ledgerPanel).toContain('登记后下一步');
    expect(ledgerPanel).toContain('刷新执行记录后归档审计');
    expect(ledgerPanel).toContain('继续登记待登记付款');
    expect(ledgerPanel).toContain('先处理暂不可登记阻断');
  });

  it('records the seventy first stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 71 | 付款登记后批次复核摘要 |');
    expect(checklist).toContain('scripts/payment-batch-registration-review-summary-ui.test.ts');
    expect(checklist).toContain('登记后复核摘要');
  });
});
