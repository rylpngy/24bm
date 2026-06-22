import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch resolution queue UI', () => {
  it('derives queue status rows for the selected block reason', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('describePaymentBatchResolutionQueueStatus');
    expect(ledgerPanel).toContain('selectedPaymentBatchReasonResolutionRows');
    expect(ledgerPanel).toContain('blockResolutionStage');
    expect(ledgerPanel).toContain('blockResolutionRefreshHint');
    expect(ledgerPanel).toContain('selectedPaymentBatchReasonResolutionStageSummary');
  });

  it('renders resolution queue status and distribution in the current reason detail', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('处理队列状态');
    expect(ledgerPanel).toContain('队列状态分布');
    expect(ledgerPanel).toContain('待处理');
    expect(ledgerPanel).toContain('处理中');
    expect(ledgerPanel).toContain('已处理待刷新');
    expect(ledgerPanel).toContain('仍阻断');
    expect(ledgerPanel).toContain('刷新提示');
  });

  it('records the forty sixth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第46轮');
    expect(checklist).toContain('付款阻断处理队列状态');
    expect(checklist).toContain('scripts/payment-batch-resolution-queue-ui.test.ts');
  });
});
