import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution registration post action UI', () => {
  it('shows a post-registration review hint beside execution registration actions', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('registrationPostActionHint');
    expect(ledgerPanel).toContain('登记后复核提示');
    expect(ledgerPanel).toContain('登记后刷新执行记录');
    expect(ledgerPanel).toContain('回看已登记金额和待登记金额');
    expect(ledgerPanel).toContain('已登记记录进入归档审计');
    expect(ledgerPanel).toContain('真实支付仍不接入');
  });

  it('records the seventieth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 70 | 付款登记后复核提示 |');
    expect(checklist).toContain('scripts/payment-batch-execution-registration-post-action-ui.test.ts');
    expect(checklist).toContain('登记后复核提示');
  });
});
