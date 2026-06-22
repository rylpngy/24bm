import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment request ledger queue UI', () => {
  it('passes variance handling records into the buyer reconciliation ledger', () => {
    const app = read('App.tsx');
    const buyerInvoicesModule = app.slice(
      app.indexOf("{activeModule === 'invoices' && ("),
      app.indexOf('<InvoicePaymentDetailPanelView'),
    );

    expect(buyerInvoicesModule).toContain('varianceHandlings={varianceHandlings}');
  });

  it('summarizes blocked and restored payment request queues in the ledger', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('varianceHandlings?: VarianceHandlingRecord[]');
    expect(ledgerPanel).toContain('varianceHandlingByInvoice');
    expect(ledgerPanel).toContain('buildPaymentRequestReadinessLabel');
    expect(ledgerPanel).toContain('paymentRequestBlockedCount');
    expect(ledgerPanel).toContain('paymentRequestRestoredCount');
    expect(ledgerPanel).toContain('付款阻断');
    expect(ledgerPanel).toContain('已恢复申请');
    expect(ledgerPanel).toContain('差异已处理，付款申请已恢复');
  });

  it('records the ledger queue increment in the stage-four checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('对账台账付款队列状态');
    expect(checklist).toContain('scripts/payment-request-ledger-queue-ui.test.ts');
  });
});
