import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch archive read-only freeze', () => {
  it('guards archived payment batches from later finance mutations in Java service', () => {
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const javaTest = read('backend-java/src/test/java/com/procurement/FinanceActionPaymentBlockingTests.java');

    expect(service).toContain('requirePaymentBatchNotArchived');
    expect(service).toContain('Payment batch is archived and can only be audited');
    expect(service).toContain('requirePaymentBatchNotArchived(tenantId, record.paymentBatchNo())');
    expect(service).toContain('requirePaymentBatchNotArchived(tenantId, paymentRequest.paymentBatchNo())');
    expect(service).toContain('findByTenantAndInvoice(tenantId, varianceHandling.invoiceId())');
    expect(service).toContain('requirePaymentBatchNotArchived(tenantId, linkedPaymentRequest.paymentBatchNo())');
    expect(javaTest).toContain('archivedPaymentBatchFreezesPaymentRequestExecutionAndVarianceMutations');
  });

  it('shows archived batches as read-only in the buyer payment batch detail panel', () => {
    const app = read('App.tsx');

    expect(app).toContain('selectedPaymentBatchArchived');
    expect(app).toContain('归档冻结边界');
    expect(app).toContain('批次已归档，后续仅允许查看审计追踪');
    expect(app).toContain('selectedPaymentBatchArchived || !javaEnabled');
    expect(app).toContain('selectedPaymentBatchArchived || buyerFulfillmentBusyId === `payment-request:${request.invoiceId}`');
    expect(app).toContain('selectedPaymentBatchArchived || !canRegisterPaymentExecution(row.registrationReleaseDecision)');
    expect(app).toContain('selectedPaymentBatchArchived || buyerFulfillmentBusyId === `variance:${request.invoiceId}`');
  });

  it('documents the seventy sixth stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 76 | 付款批次归档后只读冻结 |');
    expect(checklist).toContain('scripts/payment-batch-archive-freeze.test.ts');
    expect(checklist).toContain('付款申请、差异处理、执行登记和阻断处理写入');
  });
});
