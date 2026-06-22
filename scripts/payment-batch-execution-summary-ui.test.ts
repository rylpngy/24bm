import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution summary UI', () => {
  it('summarizes registered, pending, and blocked execution amounts in batch detail', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchRegisteredAmount');
    expect(ledgerPanel).toContain('selectedPaymentBatchPendingRegistrationAmount');
    expect(ledgerPanel).toContain('selectedPaymentBatchBlockedAmount');
    expect(ledgerPanel).toContain('selectedPaymentBatchPendingRegistrationCount');
    expect(ledgerPanel).toContain('selectedPaymentBatchBlockedCount');
    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionDecisionLabel');
    expect(ledgerPanel).toContain('已登记金额');
    expect(ledgerPanel).toContain('待登记金额');
    expect(ledgerPanel).toContain('暂不可登记金额');
    expect(ledgerPanel).toContain('待登记笔数');
    expect(ledgerPanel).toContain('暂不可登记笔数');
    expect(ledgerPanel).toContain('执行判断');
  });

  it('records the thirty seventh stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第37轮');
    expect(checklist).toContain('付款批次执行汇总指标');
    expect(checklist).toContain('scripts/payment-batch-execution-summary-ui.test.ts');
  });
});
