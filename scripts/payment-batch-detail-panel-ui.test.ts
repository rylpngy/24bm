import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch detail panel UI', () => {
  it('surfaces selected buyer payment batch details with request and invoice drilldown', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('selectedPaymentBatchNo');
    expect(ledgerPanel).toContain('setSelectedPaymentBatchNo');
    expect(ledgerPanel).toContain('selectedPaymentBatchRow');
    expect(ledgerPanel).toContain('selectedPaymentBatchRequests');
    expect(ledgerPanel).toContain('selectedPaymentBatchInvoiceRows');
    expect(ledgerPanel).toContain('选择批次');
    expect(ledgerPanel).toContain('付款批次详情');
    expect(ledgerPanel).toContain('批次内付款申请');
    expect(ledgerPanel).toContain('批次内发票');
    expect(ledgerPanel).toContain('三单匹配状态');
    expect(ledgerPanel).toContain('差异处理状态');
    expect(ledgerPanel).toContain('付款执行边界');
  });

  it('records the twenty-third stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('付款批次详情侧栏');
    expect(checklist).toContain('第二十三轮');
    expect(checklist).toContain('scripts/payment-batch-detail-panel-ui.test.ts');
  });
});
