import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch archive audit panel UI', () => {
  it('groups archive audit, freeze boundary, registration summary and ledger handoff in one panel', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('归档审计面板');
    expect(ledgerPanel).toContain('归档动作');
    expect(ledgerPanel).toContain('冻结反馈');
    expect(ledgerPanel).toContain('付款登记摘要');
    expect(ledgerPanel).toContain('处理记录入口');
    expect(ledgerPanel).toContain('审计追踪入口');
    expect(ledgerPanel).toContain('selectedPaymentBatchArchiveAuditSummary');
    expect(ledgerPanel).toContain('selectedPaymentBatchFreezeHint');
    expect(ledgerPanel).toContain('selectedPaymentBatchRegistrationReviewSummary');
    expect(ledgerPanel).toContain('selectedPaymentBatchResolutionLedgerRows.length');
  });

  it('documents the seventy eighth stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 78 | 付款批次归档审计面板 |');
    expect(checklist).toContain('scripts/payment-batch-archive-audit-panel-ui.test.ts');
    expect(checklist).toContain('归档动作、冻结反馈、付款登记摘要和处理记录入口');
  });
});
