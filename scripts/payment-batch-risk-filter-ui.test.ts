import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch risk filter UI', () => {
  it('adds buyer payment batch risk filter and priority sorting controls', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBatchRiskFilter');
    expect(ledgerPanel).toContain('setPaymentBatchRiskFilter');
    expect(ledgerPanel).toContain('paymentBatchRiskFilterOptions');
    expect(ledgerPanel).toContain('filteredPaymentBatchRows');
    expect(ledgerPanel).toContain('paymentBatchRiskRank');
    expect(ledgerPanel).toContain('批次风险筛选');
    expect(ledgerPanel).toContain('全部批次');
    expect(ledgerPanel).toContain('逾期优先');
    expect(ledgerPanel).toContain('7天内到期');
    expect(ledgerPanel).toContain('可执行批次');
    expect(ledgerPanel).toContain('审批中批次');
  });

  it('records the twenty-second stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('付款批次风险筛选');
    expect(checklist).toContain('第二十二轮');
    expect(checklist).toContain('scripts/payment-batch-risk-filter-ui.test.ts');
  });
});
