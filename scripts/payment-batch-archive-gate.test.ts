import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch archive gate', () => {
  it('guards Java payment batch archive until all execution records are registered', () => {
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const javaTest = read('backend-java/src/test/java/com/procurement/FinanceActionPaymentBlockingTests.java');

    expect(service).toContain('requirePaymentBatchArchiveReady');
    expect(service).toContain('summarizeByTenantAndBatch(tenantId, paymentBatchNo)');
    expect(service).toContain('Payment batch cannot be archived until all execution records are registered');
    expect(javaTest).toContain('archivingPaymentBatchIsBlockedUntilAllExecutionRecordsAreRegistered');
    expect(javaTest).toContain('pending_registration_count');
    expect(javaTest).toContain("verify(paymentBatchMapper, never()).updateStatus");
  });

  it('shows and enforces the archive gate in the buyer payment batch list', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('isPaymentBatchArchiveReady');
    expect(ledgerPanel).toContain("row.executionDecision === '批次付款已登记'");
    expect(ledgerPanel).toContain('归档门禁');
    expect(ledgerPanel).toContain('全部执行记录已登记后才可归档');
    expect(ledgerPanel).toContain('!isPaymentBatchArchiveReady(row)');
  });

  it('documents the seventy fourth stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 74 | 付款批次归档门禁 |');
    expect(checklist).toContain('scripts/payment-batch-archive-gate.test.ts');
    expect(checklist).toContain('全部执行记录已登记后才允许归档');
  });
});
