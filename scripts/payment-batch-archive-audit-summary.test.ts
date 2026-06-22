import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch archive audit summary', () => {
  it('records archive audit action with the execution summary before archiving', () => {
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const javaTest = read('backend-java/src/test/java/com/procurement/FinanceActionPaymentBlockingTests.java');

    expect(service).toContain('buildPaymentBatchArchiveAuditAction');
    expect(service).toContain('payment_batch.archived|registered=');
    expect(service).toContain('|amount=');
    expect(service).toContain('|decision=');
    expect(javaTest).toContain('archivingPaymentBatchRecordsExecutionSummaryAudit');
    expect(javaTest).toContain('payment_batch.archived|registered=2|amount=2400|decision=批次付款已登记');
  });

  it('shows archive audit actor, time, and pre-archive execution summary in buyer batch detail', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const SupplierWorkbenchView'),
    );
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(buyerWorkspace).toContain('auditLogs={workspace.auditLogs}');
    expect(ledgerPanel).toContain('auditLogs?: AuditLogRecord[]');
    expect(ledgerPanel).toContain('selectedPaymentBatchArchiveAudit');
    expect(ledgerPanel).toContain("log.action.startsWith('payment_batch.archived')");
    expect(ledgerPanel).toContain('归档审计摘要');
    expect(ledgerPanel).toContain('归档人');
    expect(ledgerPanel).toContain('归档时间');
    expect(ledgerPanel).toContain('归档前执行摘要');
  });

  it('documents the seventy fifth stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 75 | 付款批次归档审计摘要 |');
    expect(checklist).toContain('scripts/payment-batch-archive-audit-summary.test.ts');
    expect(checklist).toContain('归档人、归档时间和归档前执行摘要');
  });
});
