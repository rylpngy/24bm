import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment request variance blocking UI', () => {
  it('surfaces unhandled amount variance as a payment request blocker', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(invoiceDetailView).toContain('paymentRequestBlockedByVariance');
    expect(invoiceDetailView).toContain("varianceHandling?.status !== '已处理'");
    expect(invoiceDetailView).toContain('差异未处理，暂不能创建付款申请');
    expect(invoiceDetailView).toContain('差异已处理，付款申请已恢复');
    expect(invoiceDetailView).toContain('paymentRequestCreateDisabled');
  });

  it('records the payment blocking increment in the stage-four checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('差异未处理阻断付款申请');
    expect(checklist).toContain('差异处理后恢复付款申请');
    expect(checklist).toContain('scripts/payment-request-variance-blocking-ui.test.ts');
    expect(checklist).toContain('FinanceActionPaymentBlockingTests');
  });
});
