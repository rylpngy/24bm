import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution refresh hint UI', () => {
  it('prompts buyer to refresh execution records after payment requests are all approved', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchAllPaymentRequestsApproved');
    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionRefreshHint');
    expect(ledgerPanel).toContain('执行记录刷新提示');
    expect(ledgerPanel).toContain('付款申请均已通过，请刷新三单匹配和执行记录后再进入付款登记。');
    expect(ledgerPanel).toContain('仍有付款申请待复核，先完成付款申请复核再刷新执行记录。');
    expect(ledgerPanel).toContain('真实支付仍不接入');
  });

  it('records the sixty sixth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 66 | 付款申请完成后执行记录刷新提示 |');
    expect(checklist).toContain('scripts/payment-batch-execution-refresh-hint-ui.test.ts');
    expect(checklist).toContain('执行记录刷新提示');
  });
});
