import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch detail block reason UI', () => {
  it('derives selected batch execution rows for the active block reason', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchReasonExecutionRows');
    expect(ledgerPanel).toContain('selectedPaymentBatchReasonAmount');
    expect(ledgerPanel).toContain('selectedPaymentBatchReasonCount');
    expect(ledgerPanel).toContain("paymentBatchBlockReasonFilter !== '全部阻断原因'");
    expect(ledgerPanel).toContain('row.executionBlockReason === paymentBatchBlockReasonFilter');
  });

  it('renders current reason detail inside the selected payment batch panel', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('当前原因明细');
    expect(ledgerPanel).toContain('当前原因笔数');
    expect(ledgerPanel).toContain('当前原因金额');
    expect(ledgerPanel).toContain('当前原因筛选');
    expect(ledgerPanel).toContain('该批次当前原因下暂无执行记录');
    expect(ledgerPanel).toContain('切换为全部阻断原因');
  });

  it('records the forty fourth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第44轮');
    expect(checklist).toContain('付款批次当前原因明细');
    expect(checklist).toContain('scripts/payment-batch-detail-block-reason-ui.test.ts');
  });
});
