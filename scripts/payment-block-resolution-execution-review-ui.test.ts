import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution execution review UI', () => {
  it('summarizes handled payment block resolutions in the batch execution decision area', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchResolvedBlockCount');
    expect(ledgerPanel).toContain("resolution.resolutionStatus === '已处理待刷新'");
    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionReviewLabel');
    expect(ledgerPanel).toContain('执行复核提示');
    expect(ledgerPanel).toContain('复核边界');
    expect(ledgerPanel).toContain('处理记录只影响复核提示，不自动改写付款、三单或差异状态。');
  });

  it('records the fifty ninth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 59 | 阻断处理执行复核提示 |');
    expect(checklist).toContain('scripts/payment-block-resolution-execution-review-ui.test.ts');
    expect(checklist).toContain('已处理待刷新');
  });
});
