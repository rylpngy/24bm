import { describe, expect, it } from 'vitest';
import { buildContractPaymentReconciliation } from './contract-payment-reconciliation';

describe('buildContractPaymentReconciliation', () => {
  it('links contract, payment requests, batches, executions, and milestones by order/payment batch', () => {
    const result = buildContractPaymentReconciliation({
      contract: {
        id: 'contract-1',
        relatedOrderId: 'po-1',
        amount: 1000,
      },
      milestones: [
        { id: 'm-1', amount: 300, status: '已付', reached: true },
        { id: 'm-2', amount: 400, status: '待付款', reached: true },
      ],
      paymentRequests: [
        {
          id: 'pr-1',
          orderId: 'po-1',
          amount: 300,
          requestStatus: '付款申请已通过',
          paymentBatchNo: 'PB-1',
        },
        {
          id: 'pr-2',
          orderId: 'po-2',
          amount: 900,
          requestStatus: '付款申请已通过',
          paymentBatchNo: 'PB-2',
        },
      ],
      paymentBatches: [
        {
          paymentBatchNo: 'PB-1',
          totalAmount: 300,
          registeredAmount: 300,
          blockedRegistrationCount: 0,
        },
        {
          paymentBatchNo: 'PB-2',
          totalAmount: 900,
          blockedRegistrationCount: 1,
        },
      ],
      executionRecords: [
        {
          id: 'exec-1',
          paymentRequestId: 'pr-1',
          paymentBatchNo: 'PB-1',
          registeredAmount: 300,
          executionStatus: '已登记付款',
        },
        {
          id: 'exec-2',
          paymentRequestId: 'pr-2',
          paymentBatchNo: 'PB-2',
          registeredAmount: 900,
          executionStatus: '暂不可登记',
        },
      ],
    });

    expect(result.paymentRequestCount).toBe(1);
    expect(result.paymentBatchNos).toEqual(['PB-1']);
    expect(result.paymentRequestAmount).toBe(300);
    expect(result.registeredAmount).toBe(300);
    expect(result.milestonePaidAmount).toBe(300);
    expect(result.reachedUnpaidAmount).toBe(400);
    expect(result.unregisteredContractAmount).toBe(700);
    expect(result.status).toBe('里程碑达成待付款');
  });

  it('marks blocked payment execution before coverage warnings', () => {
    const result = buildContractPaymentReconciliation({
      contract: { id: 'contract-1', relatedOrderId: 'po-1', amount: 1000 },
      milestones: [{ id: 'm-1', amount: 300, status: '待付款', reached: false }],
      paymentRequests: [
        {
          id: 'pr-1',
          orderId: 'po-1',
          amount: 300,
          requestStatus: '付款申请已通过',
          paymentBatchNo: 'PB-1',
        },
      ],
      paymentBatches: [{ paymentBatchNo: 'PB-1', blockedRegistrationCount: 1 }],
      executionRecords: [
        {
          id: 'exec-1',
          paymentRequestId: 'pr-1',
          paymentBatchNo: 'PB-1',
          executionStatus: '暂不可登记',
          executionBlockReason: '前序里程碑未付款',
        },
      ],
    });

    expect(result.blockedCount).toBe(1);
    expect(result.blockReasons).toEqual(['前序里程碑未付款']);
    expect(result.status).toBe('存在付款阻断');
  });
});
