import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution registration action UI', () => {
  it('uses the dedicated Java execution registration action from executable batch execution records', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('onRegisterPaymentExecutionRecord?: (executionRecordId: string) => void');
    expect(ledgerPanel).toContain('executionRecordId: record.id');
    expect(ledgerPanel).toContain("registrationReleaseDecision === '可进入付款登记'");
    expect(ledgerPanel).toContain('onRegisterPaymentExecutionRecord(row.executionRecordId)');
    expect(ledgerPanel).toContain('登记付款状态');
    expect(ledgerPanel).toContain('登记入口边界');
    expect(ledgerPanel).toContain('仅登记付款状态，不接真实支付');
    expect(ledgerPanel).toContain("buyerFulfillmentBusyId === `payment-execution:${row.executionRecordId}`");
  });

  it('records the sixty ninth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 69 | 付款执行记录登记入口 |');
    expect(checklist).toContain('scripts/payment-batch-execution-registration-action-ui.test.ts');
    expect(checklist).toContain('登记付款状态');
  });
});
