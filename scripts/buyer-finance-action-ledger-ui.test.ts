import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer finance action ledger UI', () => {
  it('adds variance handling and payment request ledgers to invoice detail', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(invoiceDetailView).toContain('const varianceHandlingRows');
    expect(invoiceDetailView).toContain('const paymentRequestRows');
    expect(invoiceDetailView).toContain('DetailSection title="差异处理台账"');
    expect(invoiceDetailView).toContain('DetailSection title="付款申请台账"');
    expect(invoiceDetailView).toContain('责任人');
    expect(invoiceDetailView).toContain('处理结果');
    expect(invoiceDetailView).toContain('申请状态');
    expect(invoiceDetailView).toContain('付款批次');
    expect(invoiceDetailView).toContain('暂未落库为独立付款申请');
  });

  it('summarizes variance and payment request batches in the reconciliation ledger', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('varianceQueueCount');
    expect(ledgerPanel).toContain('paymentRequestReadyCount');
    expect(ledgerPanel).toContain('付款申请队列');
    expect(ledgerPanel).toContain('差异处理队列');
    expect(ledgerPanel).toContain('可付款批次');
    expect(ledgerPanel).toContain('待差异处理');
  });

  it('updates the stage four checklist with the second finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('差异处理台账');
    expect(checklist).toContain('付款申请台账');
    expect(checklist).toContain('第二轮');
    expect(checklist).toContain('scripts/buyer-finance-action-ledger-ui.test.ts');
  });
});
