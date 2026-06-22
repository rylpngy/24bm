import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch execution record Java UI integration', () => {
  it('passes Java payment execution records from buyer master data into the reconciliation ledger panel', () => {
    const app = read('App.tsx');

    expect(app).toContain('type PaymentExecutionRecord');
    expect(app).toContain('paymentExecutionRecords: PaymentExecutionRecord[]');
    expect(app).toContain('paymentExecutionRecords: javaBuyerMasterData.paymentExecutionRecords ?? []');
    expect(app).toContain('const paymentExecutionRecords = javaBuyerMasterData?.paymentExecutionRecords ?? []');
    expect(app).toContain('paymentExecutionRecords={buyerData.paymentExecutionRecords}');
    expect(app).toContain('paymentExecutionRecords={paymentExecutionRecords}');
  });

  it('prefers Java execution records in payment batch details and falls back to derived rows', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentExecutionRecords?: PaymentExecutionRecord[]');
    expect(ledgerPanel).toContain('paymentExecutionRecords = []');
    expect(ledgerPanel).toContain('selectedPaymentBatchJavaExecutionRows');
    expect(ledgerPanel).toContain('selectedPaymentBatchDerivedExecutionRows');
    expect(ledgerPanel).toContain('selectedPaymentBatchExecutionRows = selectedPaymentBatchJavaExecutionRows.length > 0');
    expect(ledgerPanel).toContain("executionTraceSource: 'Java执行台账'");
    expect(ledgerPanel).toContain("executionTraceSource: '前端派生轨迹'");
    expect(ledgerPanel).toContain('执行记录来源');
  });

  it('records the thirty sixth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第36轮');
    expect(checklist).toContain('付款执行记录前端接入 Java 台账');
    expect(checklist).toContain('scripts/payment-batch-execution-record-java-ui.test.ts');
  });
});
