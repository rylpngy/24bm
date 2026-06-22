import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch detail actions UI', () => {
  it('lets buyer operate payment request and variance statuses inside batch detail', () => {
    const app = read('App.tsx');
    const buyerInvoicesModule = app.slice(
      app.indexOf('<ReconciliationLedgerPanel'),
      app.indexOf('{filteredInvoicePaymentRows.length === 0'),
    );
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(buyerInvoicesModule).toContain('onUpdatePaymentRequestStatus={onUpdatePaymentRequestStatus}');
    expect(buyerInvoicesModule).toContain('onUpdateVarianceHandlingStatus={onUpdateVarianceHandlingStatus}');
    expect(ledgerPanel).toContain('onUpdatePaymentRequestStatus?:');
    expect(ledgerPanel).toContain('onUpdateVarianceHandlingStatus?:');
    expect(ledgerPanel).toContain('提交付款审批');
    expect(ledgerPanel).toContain('通过付款申请');
    expect(ledgerPanel).toContain('标记差异已处理');
    expect(ledgerPanel).toContain('退回差异复核');
    expect(ledgerPanel).toContain("onUpdatePaymentRequestStatus(request.id, '付款申请审批中')");
    expect(ledgerPanel).toContain("advanceFocusedPaymentRequestAfterStatusChange(request.id, '付款申请已通过')");
    expect(ledgerPanel).toContain("onUpdateVarianceHandlingStatus(varianceHandling.id, '已处理')");
    expect(ledgerPanel).toContain("onUpdateVarianceHandlingStatus(varianceHandling.id, '待复核')");
  });

  it('records the twenty-fourth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('批次详情内联操作');
    expect(checklist).toContain('第二十四轮');
    expect(checklist).toContain('scripts/payment-batch-detail-actions-ui.test.ts');
  });
});
