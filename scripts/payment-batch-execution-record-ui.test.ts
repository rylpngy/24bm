import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution record UI', () => {
  it('shows simulated execution records and payment registration boundaries in batch detail', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionRows');
    expect(ledgerPanel).toContain('selectedPaymentBatchRegisteredPaymentCount');
    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionSummary');
    expect(ledgerPanel).toContain('付款批次执行记录');
    expect(ledgerPanel).toContain('模拟执行轨迹');
    expect(ledgerPanel).toContain('付款登记状态');
    expect(ledgerPanel).toContain('真实支付边界');
    expect(ledgerPanel).toContain('不接真实支付');
    expect(ledgerPanel).toContain('仅记录计划执行和付款登记轨迹');
  });

  it('records the twenty-fifth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('付款批次执行记录');
    expect(checklist).toContain('第二十五轮');
    expect(checklist).toContain('scripts/payment-batch-execution-record-ui.test.ts');
  });
});
