import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment batch smoke coverage', () => {
  it('extends local Java smoke to create payment requests and verify payment batches', () => {
    const smoke = read('scripts/java-local-smoke.mjs');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentBatchMapper.java');

    expect(smoke).toContain('/api/v1/buyer/payment-requests');
    expect(smoke).toContain('/api/v1/buyer/payment-batches');
    expect(smoke).toContain('/api/v1/buyer/payment-execution-records');
    expect(smoke).toContain('paymentBatchNo');
    expect(smoke).toContain('paymentBatchAfterSubmit');
    expect(smoke).toContain('paymentBatchAfterApproval');
    expect(smoke).toContain('/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status');
    expect(smoke).toContain('/api/v1/buyer/approvals/pending');
    expect(smoke).toContain('paymentBatchAfterBatchSubmit');
    expect(smoke).toContain('paymentBatchAfterBatchApproval');
    expect(smoke).toContain("item.bizType === 'payment_batch'");
    expect(smoke).toContain('Java smoke did not expose payment batch approval task');
    expect(smoke).toContain('paymentBatchAfterArchive');
    expect(smoke).toContain('paymentExecutionRecordBeforePayment');
    expect(smoke).toContain('paymentExecutionRecordAfterPayment');
    expect(smoke).toContain("requestStatus: '付款申请审批中'");
    expect(smoke).toContain("requestStatus: '付款申请已通过'");
    expect(smoke).toContain("batchStatus: '审批中'");
    expect(smoke).toContain("batchStatus: '可安排付款'");
    expect(smoke).toContain("batchStatus: '已付款归档'");
    expect(smoke).toContain("paymentBatchAfterSubmit.batchStatus !== '审批中'");
    expect(smoke).toContain("paymentBatchAfterApproval.batchStatus !== '可安排付款'");
    expect(smoke).toContain("executionStatus !== '待登记付款'");
    expect(smoke).toContain("executionStatus !== '已登记付款'");
    expect(mapper).not.toContain('i.due_date');
    expect(mapper).toContain("i.created_at::date + interval '30 days'");
  });

  it('records the ninth stage-four finance increment in the checklist and local integration docs', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const localDoc = read('docs/local-java-integration.md');

    expect(checklist).toContain('第九轮');
    expect(checklist).toContain('付款批次 smoke');
    expect(checklist).toContain('scripts/java-payment-batch-smoke.test.ts');
    expect(localDoc).toContain('付款申请和付款批次 smoke');
    expect(localDoc).toContain('GET /api/v1/buyer/payment-batches');
    expect(localDoc).toContain('GET /api/v1/buyer/payment-execution-records');
    expect(localDoc).toContain('payment_batch');
  });
});
