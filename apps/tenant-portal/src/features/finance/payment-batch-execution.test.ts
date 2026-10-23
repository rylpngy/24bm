import { describe, expect, it } from 'vitest';
import { buildPaymentBatchExecutionSummaries } from './payment-batch-execution';

describe('buildPaymentBatchExecutionSummaries', () => {
  it('groups execution records by payment batch and prioritizes blocked records', () => {
    const summaries = buildPaymentBatchExecutionSummaries([
      {
        id: 'exec-registered',
        paymentBatchNo: 'PB-001',
        invoiceId: 'inv-1',
        registeredAmount: 300,
        executionStatus: '已登记付款',
        releaseEvidenceNo: 'BANK-001',
        releaseRemark: '银行回单已上传',
      },
      {
        id: 'exec-blocked',
        paymentBatchNo: 'PB-001',
        paymentRequestId: 'pay-2',
        registeredAmount: 0,
        executionStatus: '暂不可登记',
        executionBlockReason: '前序里程碑未付款',
        executionNextAction: '补齐前序里程碑',
      },
      {
        id: 'exec-pending',
        paymentBatchNo: 'PB-002',
        paymentRequestId: 'pay-3',
        registeredAmount: 500,
        executionStatus: '待登记付款',
      },
    ]);

    expect(summaries.get('PB-001')).toMatchObject({
      totalCount: 2,
      registeredAmount: 300,
      blockedAmount: 0,
      pendingAmount: 0,
    });
    expect(summaries.get('PB-001')?.records.map((record) => record.id)).toEqual([
      'exec-blocked',
      'exec-registered',
    ]);
    expect(summaries.get('PB-001')?.records[0]).toMatchObject({
      explanation: '前序里程碑未付款',
      nextAction: '补齐前序里程碑',
    });
    expect(summaries.get('PB-001')?.records[1]).toMatchObject({
      evidence: 'BANK-001',
      explanation: '银行回单已上传',
    });
    expect(summaries.get('PB-002')).toMatchObject({
      totalCount: 1,
      registeredAmount: 500,
      blockedAmount: 0,
      pendingAmount: 0,
    });
  });

  it('attaches matching block resolution actions to blocked records', () => {
    const summaries = buildPaymentBatchExecutionSummaries(
      [
        {
          id: 'exec-blocked',
          paymentBatchNo: 'PB-001',
          paymentRequestId: 'pay-2',
          invoiceId: 'inv-2',
          registeredAmount: 700,
          executionStatus: '暂不可登记',
          executionBlockReason: '前序里程碑未付款',
        },
      ],
      [
        {
          id: 'res-1',
          paymentBatchNo: 'PB-001',
          paymentRequestId: 'pay-2',
          invoiceId: 'inv-2',
          blockReason: '前序里程碑未付款',
          resolutionStatus: '待处理',
          nextStep: '补齐前序里程碑',
        },
      ],
    );

    expect(summaries.get('PB-001')?.records[0]).toMatchObject({
      id: 'exec-blocked',
      resolutionId: 'res-1',
      resolutionStatus: '待处理',
      nextAction: '补齐前序里程碑',
    });
  });
});
