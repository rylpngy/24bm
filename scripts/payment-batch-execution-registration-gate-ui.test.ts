import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution registration gate UI', () => {
  it('shows registration gate, release decision, and next action for execution records', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('describePaymentExecutionRegistrationGate');
    expect(ledgerPanel).toContain('registrationGateStatus');
    expect(ledgerPanel).toContain('registrationReleaseDecision');
    expect(ledgerPanel).toContain('registrationNextAction');
    expect(ledgerPanel).toContain('登记前置条件');
    expect(ledgerPanel).toContain('登记放行判断');
    expect(ledgerPanel).toContain('下一处理动作');
    expect(ledgerPanel).toContain('可进入付款登记');
    expect(ledgerPanel).toContain('仍阻断付款登记');
    expect(ledgerPanel).toContain('真实支付仍不接入');
  });

  it('records the sixty eighth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 68 | 付款执行登记前置条件显性化 |');
    expect(checklist).toContain('scripts/payment-batch-execution-registration-gate-ui.test.ts');
    expect(checklist).toContain('登记前置条件');
  });
});
