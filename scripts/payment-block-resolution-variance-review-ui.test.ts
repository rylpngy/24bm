import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution variance review UI', () => {
  it('shows pending variance count and can select the first pending variance invoice from review actions', () => {
    const app = read('App.tsx');
    const buyerInvoicesModule = app.slice(
      app.indexOf("activeModule === 'invoices'"),
      app.indexOf("activeModule === 'audit'"),
    );
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(buyerInvoicesModule).toContain('onSelectInvoiceForReview={(invoiceId) => {');
    expect(buyerInvoicesModule).toContain("setInvoiceStatusFilter('全部状态')");
    expect(buyerInvoicesModule).toContain('setSelectedInvoiceId(invoiceId)');
    expect(ledgerPanel).toContain('selectedPaymentBatchPendingVarianceRows');
    expect(ledgerPanel).toContain('selectedPaymentBatchPendingVarianceCount');
    expect(ledgerPanel).toContain('reviewTargetInvoiceId');
    expect(ledgerPanel).toContain('待处理差异数量');
    expect(ledgerPanel).toContain('定位待处理差异');
    expect(ledgerPanel).toContain('onSelectInvoiceForReview(row.reviewTargetInvoiceId)');
  });

  it('records the sixty second stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 62 | 差异处理复核定位 |');
    expect(checklist).toContain('scripts/payment-block-resolution-variance-review-ui.test.ts');
    expect(checklist).toContain('待处理差异数量');
  });
});
