import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch approval action UI', () => {
  it('surfaces buyer payment batch approval actions in the reconciliation ledger', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );
    const buyerInvoicesModule = app.slice(
      app.indexOf("{activeModule === 'invoices' && ("),
      app.indexOf('<InvoicePaymentDetailPanelView'),
    );

    expect(buyerInvoicesModule).toContain('onUpdatePaymentBatchStatus={updatePaymentBatchStatus}');
    expect(ledgerPanel).toContain('onUpdatePaymentBatchStatus?:');
    expect(ledgerPanel).toContain('提交批次审批');
    expect(ledgerPanel).toContain('通过批次审批');
    expect(ledgerPanel).toContain('标记付款归档');
    expect(ledgerPanel).toContain('批次级审批');
    expect(ledgerPanel).toContain('const canApprovePaymentBatch');
    expect(ledgerPanel).toContain('row.approvedAmount >= row.amount');
    expect(ledgerPanel).toContain('!canApprovePaymentBatch(row)');
    expect(ledgerPanel).toContain('付款申请未全部通过，已审批');
  });

  it('records the nineteenth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('付款批次审批入口');
    expect(checklist).toContain('第十九轮');
    expect(checklist).toContain('scripts/payment-batch-approval-action-ui.test.ts');
    expect(checklist).toContain('scripts/java-payment-batch-status-flow.test.ts');
  });
});
