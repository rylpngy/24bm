import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch plan UI', () => {
  it('derives buyer payment batches from Java payment request records', () => {
    const app = read('App.tsx');
    const buyerInvoicesModule = app.slice(
      app.indexOf("{activeModule === 'invoices'"),
      app.indexOf('<InvoicePaymentDetailPanelView'),
    );
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(buyerInvoicesModule).toContain('paymentRequests={paymentRequests}');
    expect(ledgerPanel).toContain('paymentRequests?: PaymentRequestRecord[]');
    expect(ledgerPanel).toContain('buildPaymentBatchRows');
    expect(ledgerPanel).toContain('paymentBatchRows');
    expect(ledgerPanel).toContain('paymentBatchTotalAmount');
    expect(ledgerPanel).toContain('付款批次台账');
    expect(ledgerPanel).toContain('批次金额');
    expect(ledgerPanel).toContain('批次状态');
    expect(ledgerPanel).toContain('计划付款日');
  });

  it('surfaces selected invoice payment plan maturity and batch ownership', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(invoiceDetailView).toContain('paymentBatchDueLabel');
    expect(invoiceDetailView).toContain('paymentBatchOwnershipLabel');
    expect(invoiceDetailView).toContain('付款计划成熟度');
    expect(invoiceDetailView).toContain('批次归属');
    expect(invoiceDetailView).toContain('付款批次计划');
  });

  it('records the seventh stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第七轮');
    expect(checklist).toContain('付款批次台账');
    expect(checklist).toContain('付款计划深化');
    expect(checklist).toContain('scripts/payment-batch-plan-ui.test.ts');
    expect(checklist).toContain('尚未落库为独立付款批次表');
  });
});
