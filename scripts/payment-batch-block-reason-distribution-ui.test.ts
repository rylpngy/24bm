import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch block reason distribution UI', () => {
  it('builds distribution rows from blocked execution records', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBatchBlockReasonDistributionRows');
    expect(ledgerPanel).toContain('distributionByReason');
    expect(ledgerPanel).toContain('reasonCount');
    expect(ledgerPanel).toContain('reasonAmount');
    expect(ledgerPanel).toContain('reasonBatches');
    expect(ledgerPanel).toContain("paymentBatchBlockReasonFilter === row.reason");
  });

  it('renders distribution cards that can switch the block reason filter', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('阻断原因分布');
    expect(ledgerPanel).toContain('阻断笔数');
    expect(ledgerPanel).toContain('阻断金额');
    expect(ledgerPanel).toContain('涉及批次');
    expect(ledgerPanel).toContain('查看该原因');
    expect(ledgerPanel).toContain('setPaymentBatchBlockReasonFilter(row.reason)');
  });

  it('records the forty third stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第43轮');
    expect(checklist).toContain('付款阻断原因分布');
    expect(checklist).toContain('scripts/payment-batch-block-reason-distribution-ui.test.ts');
  });
});
