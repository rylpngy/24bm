import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution review action list UI', () => {
  it('renders a focused review action list after block resolution handling', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchReviewActionRows');
    expect(ledgerPanel).toContain('三单匹配刷新');
    expect(ledgerPanel).toContain('差异处理复核');
    expect(ledgerPanel).toContain('付款申请复核');
    expect(ledgerPanel).toContain('复核动作清单');
    expect(ledgerPanel).toContain('处理完成后刷新三单匹配快照，再回看付款执行记录。');
    expect(ledgerPanel).toContain('定位批次内发票，完成差异处理后刷新付款申请。');
    expect(ledgerPanel).toContain('确认付款申请已通过后再登记付款。');
  });

  it('records the sixtieth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 60 | 阻断处理复核动作清单 |');
    expect(checklist).toContain('scripts/payment-block-resolution-review-actions-ui.test.ts');
    expect(checklist).toContain('三单匹配刷新、差异处理复核和付款申请复核');
  });
});
