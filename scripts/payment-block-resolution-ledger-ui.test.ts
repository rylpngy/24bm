import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution ledger UI', () => {
  it('derives a selected batch payment block resolution ledger from Java records', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchResolutionLedgerRows');
    expect(ledgerPanel).toContain('paymentBlockResolutions.filter');
    expect(ledgerPanel).toContain('resolution.paymentBatchNo === selectedPaymentBatchRow.paymentBatchNo');
    expect(ledgerPanel).toContain('resolution.updatedAt.localeCompare');
  });

  it('renders the selected batch resolution ledger with audit and action fields', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('处理记录台账');
    expect(ledgerPanel).toContain('处理状态');
    expect(ledgerPanel).toContain('处理人');
    expect(ledgerPanel).toContain('更新时间');
    expect(ledgerPanel).toContain('阻断原因');
    expect(ledgerPanel).toContain('处理动作');
    expect(ledgerPanel).toContain('下一步');
    expect(ledgerPanel).toContain('暂无付款阻断处理记录');
  });

  it('records the fifty fifth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第55轮');
    expect(checklist).toContain('付款阻断处理记录台账');
    expect(checklist).toContain('scripts/payment-block-resolution-ledger-ui.test.ts');
  });
});
