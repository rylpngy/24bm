import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch block resolution UI', () => {
  it('derives a resolution hint for the selected block reason in the batch detail', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchReasonAction');
    expect(ledgerPanel).toContain('describePaymentBatchBlockAction(paymentBatchBlockReasonFilter)');
    expect(ledgerPanel).toContain('selectedPaymentBatchReasonResolutionStatus');
    expect(ledgerPanel).toContain('selectedPaymentBatchReasonExecutionRows.length > 0');
  });

  it('renders block resolution guidance in the current reason detail section', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('当前处理状态');
    expect(ledgerPanel).toContain('处理路径');
    expect(ledgerPanel).toContain('处理入口');
    expect(ledgerPanel).toContain('处理闭环边界');
    expect(ledgerPanel).toContain('原因明细已定位，按处理路径推进后刷新执行记录。');
    expect(ledgerPanel).toContain('当前只是处理指引，不自动改写付款、三单或差异状态。');
  });

  it('records the forty fifth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第45轮');
    expect(checklist).toContain('付款阻断处理闭环指引');
    expect(checklist).toContain('scripts/payment-batch-block-resolution-ui.test.ts');
  });
});
