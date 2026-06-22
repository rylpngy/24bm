import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution refresh action UI', () => {
  it('turns the execution refresh hint into a guarded rebuild action', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionRefreshActionDisabled');
    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionRefreshActionLabel');
    expect(ledgerPanel).toContain('刷新执行复核');
    expect(ledgerPanel).toContain("!selectedPaymentBatchAllPaymentRequestsApproved");
    expect(ledgerPanel).toContain("buyerFulfillmentBusyId === 'three-way-rebuild'");
    expect(ledgerPanel).toContain('onRebuildThreeWayMatches()');
    expect(ledgerPanel).toContain('先完成付款申请复核');
  });

  it('records the sixty seventh stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 67 | 付款执行复核刷新入口 |');
    expect(checklist).toContain('scripts/payment-batch-execution-refresh-action-ui.test.ts');
    expect(checklist).toContain('刷新执行复核');
  });
});
