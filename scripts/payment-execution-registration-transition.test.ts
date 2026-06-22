import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment execution registration transition', () => {
  it('adds a dedicated Java endpoint for registering executable payment records', () => {
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentExecutionRecordMapper.java');

    expect(controller).toContain('@PostMapping("/payment-execution-records/{executionRecordId}/registration")');
    expect(controller).toContain('registerPaymentExecutionRecord');
    expect(service).toContain('registerCurrentTenantPaymentExecutionRecord');
    expect(service).toContain("record.executionStatus().equals(\"待登记付款\")");
    expect(service).toContain('paymentApplicationService.register');
    expect(mapper).toContain('findByTenantAndId');
    expect(mapper).toContain('refreshByTenantAndId');
  });

  it('routes the batch execution registration button through the dedicated Java client method', () => {
    const client = read('services/procurementApiClient.ts');
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(client).toContain('registerBuyerPaymentExecutionRecord');
    expect(client).toContain('/api/v1/buyer/payment-execution-records/${executionRecordId}/registration');
    expect(ledgerPanel).toContain('onRegisterPaymentExecutionRecord?: (executionRecordId: string) => void');
    expect(ledgerPanel).toContain('onRegisterPaymentExecutionRecord(row.executionRecordId)');
    expect(ledgerPanel).toContain('buyerFulfillmentBusyId === `payment-execution:${row.executionRecordId}`');
  });

  it('documents the seventy third stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 73 | 付款执行登记状态流转入口 |');
    expect(checklist).toContain('scripts/payment-execution-registration-transition.test.ts');
    expect(checklist).toContain('专用执行记录登记入口');
    expect(checklist).toContain('真实支付仍不接入');
  });

  it('uses the dedicated execution registration endpoint in the Java smoke flow', () => {
    const smoke = read('scripts/java-local-smoke.mjs');

    expect(smoke).toContain('/api/v1/buyer/payment-execution-records/${paymentExecutionRecordBeforePayment.id}/registration');
    expect(smoke).toContain('registeredExecutionRecord');
    expect(smoke).toContain('Java payment execution registration endpoint did not return registered status');
  });
});
