import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch resolution context link UI', () => {
  it('derives context links for payment block resolution action entries', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('describePaymentBatchResolutionContext');
    expect(ledgerPanel).toContain('resolutionContextPanel');
    expect(ledgerPanel).toContain('resolutionContextTargetNo');
    expect(ledgerPanel).toContain('resolutionContextInvoiceNo');
    expect(ledgerPanel).toContain('resolutionContextHint');
  });

  it('renders context link fields in resolution action cards', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('上下文定位');
    expect(ledgerPanel).toContain('目标分区');
    expect(ledgerPanel).toContain('目标单号');
    expect(ledgerPanel).toContain('关联发票');
    expect(ledgerPanel).toContain('联动说明');
    expect(ledgerPanel).toContain('已定位到批次详情');
  });

  it('records the forty ninth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第49轮');
    expect(checklist).toContain('付款阻断动作上下文联动');
    expect(checklist).toContain('scripts/payment-batch-resolution-context-link-ui.test.ts');
  });
});
