import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch schedule risk UI', () => {
  it('summarizes overdue and upcoming payment batch schedule risks', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBatchOverdueCount');
    expect(ledgerPanel).toContain('paymentBatchDueSoonCount');
    expect(ledgerPanel).toContain('paymentBatchEarliestDueDate');
    expect(ledgerPanel).toContain('paymentBatchScheduleRiskLabel');
    expect(ledgerPanel).toContain('scheduleRiskLabel');
    expect(ledgerPanel).toContain('逾期批次');
    expect(ledgerPanel).toContain('7天内到期');
    expect(ledgerPanel).toContain('最早处理日');
    expect(ledgerPanel).toContain('计划风险');
  });

  it('records the twenty-first stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('付款计划风险摘要');
    expect(checklist).toContain('第二十一轮');
    expect(checklist).toContain('scripts/payment-batch-schedule-risk-ui.test.ts');
  });
});
