import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution readiness UI', () => {
  it('summarizes approval and execution readiness for buyer payment batches', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBatchApprovalQueueCount');
    expect(ledgerPanel).toContain('paymentBatchExecutableAmount');
    expect(ledgerPanel).toContain('paymentBatchPendingSubmissionCount');
    expect(ledgerPanel).toContain('paymentBatchArchivedCount');
    expect(ledgerPanel).toContain('批次审批队列');
    expect(ledgerPanel).toContain('可执行金额');
    expect(ledgerPanel).toContain('待提交批次');
    expect(ledgerPanel).toContain('已归档批次');
    expect(ledgerPanel).toContain('执行准备');
  });

  it('records the eighteenth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('付款批次执行准备摘要');
    expect(checklist).toContain('第十八轮');
    expect(checklist).toContain('scripts/payment-batch-execution-readiness-ui.test.ts');
  });
});
