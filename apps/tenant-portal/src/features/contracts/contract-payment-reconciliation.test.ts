import { describe, expect, it } from 'vitest';
import {
  buildContractPaymentReconciliation,
  type ContractPaymentReconciliation,
  type ReconciliationStatus,
  filterContractReconciliations,
  summarizeContractReconciliations,
} from './contract-payment-reconciliation';

describe('buildContractPaymentReconciliation', () => {
  it('counts partial amounts and excludes other contracts in the same batch', () => {
    const result = buildContractPaymentReconciliation({
      contract: { id: 'c', relatedOrderId: 'o', amount: 100 },
      milestones: [{ id: 'm', amount: 50, status: '部分已付', reached: true, paidAmount: 20, remainingAmount: 30, paymentVerified: true }],
      paymentRequests: [{ id: 'p', orderId: 'o', invoiceId: 'i', paymentBatchNo: 'batch', amount: 100 }],
      paymentBatches: [],
      executionRecords: [
        { id: 'own', paymentRequestId: 'p', invoiceId: 'i', paymentBatchNo: 'batch', executionStatus: '待登记付款', registeredAmount: 20 },
        { id: 'other', paymentRequestId: 'other', invoiceId: 'other', paymentBatchNo: 'batch', executionStatus: '已登记付款', registeredAmount: 900 },
      ],
    });
    expect(result).toMatchObject({ registeredAmount: 20, milestonePaidAmount: 20, reachedUnpaidAmount: 30, unregisteredContractAmount: 80 });
  });

  it('flags historical milestone statuses without payment evidence', () => {
    const result = buildContractPaymentReconciliation({
      contract: { id: 'c', relatedOrderId: 'o', amount: 100 },
      milestones: [{ id: 'm', amount: 100, status: '已付', reached: true, paidAmount: null, remainingAmount: null, paymentVerified: false }],
      paymentRequests: [{ id: 'p', orderId: 'o', amount: 100 }], paymentBatches: [], executionRecords: [],
    });
    expect(result.milestonePaidAmount).toBe(0);
    expect(result.status).toBe('存在付款阻断');
    expect(result.blockReasons).toContain('历史合同付款金额待核对');
  });

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

  it('summarizes reconciliation totals for the workbench header', () => {
    const summary = summarizeContractReconciliations([
      {
        contractAmount: 1000,
        paymentRequestAmount: 600,
        approvedRequestAmount: 500,
        registeredAmount: 300,
        blockedCount: 1,
        unregisteredContractAmount: 700,
        reachedUnpaidAmount: 200,
        paymentRequestCount: 2,
        paymentBatchNos: ['PB-1'],
        batchCount: 1,
        blockReasons: ['前序里程碑未付款'],
        milestoneAmount: 1000,
        milestonePaidAmount: 300,
        unrequestedContractAmount: 400,
        status: '存在付款阻断',
      },
      {
        contractAmount: 2000,
        paymentRequestAmount: 2000,
        approvedRequestAmount: 2000,
        registeredAmount: 2000,
        blockedCount: 0,
        unregisteredContractAmount: 0,
        reachedUnpaidAmount: 0,
        paymentRequestCount: 1,
        paymentBatchNos: ['PB-2'],
        batchCount: 1,
        blockReasons: [],
        milestoneAmount: 2000,
        milestonePaidAmount: 2000,
        unrequestedContractAmount: 0,
        status: '已完成付款登记',
      },
    ]);

    expect(summary).toEqual({
      totalContracts: 2,
      contractAmount: 3000,
      paymentRequestAmount: 2600,
      approvedRequestAmount: 2500,
      registeredAmount: 2300,
      blockedCount: 1,
      unregisteredContractAmount: 700,
      reachedUnpaidAmount: 200,
      exceptionCount: 1,
    });
  });

  it('filters reconciliation rows by finance review queue', () => {
    const statuses: ReconciliationStatus[] = [
      '存在付款阻断',
      '里程碑达成待付款',
      '付款申请未覆盖合同',
      '已完成付款登记',
    ];
    const rows: ContractPaymentReconciliation[] = statuses.map((status, index) => ({
      contractAmount: 100,
      milestoneAmount: 100,
      milestonePaidAmount: 0,
      reachedUnpaidAmount: status === '里程碑达成待付款' ? 50 : 0,
      paymentRequestCount: 1,
      paymentRequestAmount: status === '付款申请未覆盖合同' ? 50 : 100,
      approvedRequestAmount: 50,
      paymentBatchNos: [`PB-${index}`],
      batchCount: 1,
      registeredAmount: status === '已完成付款登记' ? 100 : 0,
      blockedCount: status === '存在付款阻断' ? 1 : 0,
      blockReasons: [],
      unrequestedContractAmount: status === '付款申请未覆盖合同' ? 50 : 0,
      unregisteredContractAmount: status === '已完成付款登记' ? 0 : 100,
      status,
    }));

    expect(filterContractReconciliations(rows, '全部')).toHaveLength(4);
    expect(filterContractReconciliations(rows, '存在付款阻断')).toHaveLength(1);
    expect(filterContractReconciliations(rows, '里程碑达成待付款')).toHaveLength(1);
    expect(filterContractReconciliations(rows, '付款申请未覆盖合同')).toHaveLength(1);
    expect(filterContractReconciliations(rows, '已完成付款登记')).toHaveLength(1);
  });
});
