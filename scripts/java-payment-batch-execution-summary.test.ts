import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment batch execution summary', () => {
  it('adds execution summary fields to Java payment batch responses', () => {
    const response = read('backend-java/src/main/java/com/procurement/finance/api/PaymentBatchResponse.java');
    const domain = read('backend-java/src/main/java/com/procurement/finance/domain/PaymentBatch.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentExecutionRecordMapper.java');
    const security = read('backend-java/src/test/java/com/procurement/HttpSecurityContractTests.java');

    for (const source of [response, domain]) {
      expect(source).toContain('BigDecimal registeredAmount');
      expect(source).toContain('BigDecimal pendingRegistrationAmount');
      expect(source).toContain('BigDecimal blockedRegistrationAmount');
      expect(source).toContain('Integer registeredCount');
      expect(source).toContain('Integer pendingRegistrationCount');
      expect(source).toContain('Integer blockedRegistrationCount');
      expect(source).toContain('String executionDecision');
    }
    expect(service).toContain('refreshTenantFromPaymentRequests');
    expect(service).toContain('toPaymentBatchResponse');
    expect(mapper).toContain('summarizeByTenantAndBatch');
    expect(mapper).toContain("execution_status = '已登记付款'");
    expect(mapper).toContain("execution_status = '待登记付款'");
    expect(mapper).toContain("execution_status = '暂不可登记'");
    expect(security).toContain('paymentBatchResponse("paybatch-demo", "PAY-202606", "待提交审批")');
    expect(security).toContain('BigDecimal.valueOf(98000)');
    expect(security).toContain('可继续登记付款');
  });

  it('maps execution summary fields through the frontend Java client and batch detail UI', () => {
    const client = read('services/procurementApiClient.ts');
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(client).toContain('registeredAmount: number');
    expect(client).toContain('pendingRegistrationAmount: number');
    expect(client).toContain('blockedRegistrationAmount: number');
    expect(client).toContain('registeredCount: number');
    expect(client).toContain('pendingRegistrationCount: number');
    expect(client).toContain('blockedRegistrationCount: number');
    expect(client).toContain('executionDecision?: string | null');
    expect(client).toContain('registeredAmount: Number(paymentBatch.registeredAmount ?? 0)');
    expect(client).toContain('pendingRegistrationAmount: Number(paymentBatch.pendingRegistrationAmount ?? 0)');
    expect(client).toContain('blockedRegistrationAmount: Number(paymentBatch.blockedRegistrationAmount ?? 0)');
    expect(ledgerPanel).toContain('registeredAmount: batch.registeredAmount');
    expect(ledgerPanel).toContain('executionDecision: batch.executionDecision');
    expect(ledgerPanel).toContain('selectedPaymentBatchRow.registeredAmount');
    expect(ledgerPanel).toContain('selectedPaymentBatchRow.executionDecision');
  });

  it('records the thirty eighth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第38轮');
    expect(checklist).toContain('付款批次执行汇总 Java API');
    expect(checklist).toContain('scripts/java-payment-batch-execution-summary.test.ts');
  });
});
