import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch block queue UI', () => {
  it('adds a buyer-side block reason filter and block queue for payment batches', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBatchBlockReasonFilter');
    expect(ledgerPanel).toContain('paymentBatchBlockReasonOptions');
    expect(ledgerPanel).toContain('paymentBatchBlockQueueRows');
    expect(ledgerPanel).toContain('阻断原因筛选');
    expect(ledgerPanel).toContain('全部阻断原因');
    expect(ledgerPanel).toContain('阻断队列');
    expect(ledgerPanel).toContain('付款阻断队列');
    expect(ledgerPanel).toContain('当前阻断原因');
    expect(ledgerPanel).toContain('定位批次');
  });

  it('filters batch rows and queue rows by selected block reason without new backend APIs', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain("paymentBatchBlockReasonFilter !== '全部阻断原因'");
    expect(ledgerPanel).toContain('row.executionBlockSummary?.includes(paymentBatchBlockReasonFilter)');
    expect(ledgerPanel).toContain('row.executionBlockReason === paymentBatchBlockReasonFilter');
    expect(ledgerPanel).toContain("record.executionStatus === '暂不可登记' || record.executionStatus === '付款审批中'");
    expect(ledgerPanel).toContain('setSelectedPaymentBatchNo(row.paymentBatchNo)');
  });

  it('records the forty first stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第41轮');
    expect(checklist).toContain('付款批次阻断队列筛选');
    expect(checklist).toContain('scripts/payment-batch-block-queue-ui.test.ts');
  });
});
