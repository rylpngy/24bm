import { describe, expect, it } from 'vitest';
import { buildFinanceExceptionDashboard } from './finance-exception-dashboard';

describe('buildFinanceExceptionDashboard', () => {
  it('prioritizes blocked payments, variance handling, archive exceptions, and overdue registrations', () => {
    const dashboard = buildFinanceExceptionDashboard(
      {
        paymentBatches: [
          {
            paymentBatchNo: 'PB-BLOCKED',
            totalAmount: 1200,
            blockedRegistrationAmount: 300,
            blockedRegistrationCount: 1,
            plannedPaymentDate: '2026-06-20',
          },
          {
            paymentBatchNo: 'PB-OVERDUE',
            totalAmount: 800,
            pendingRegistrationAmount: 800,
            pendingRegistrationCount: 1,
            plannedPaymentDate: '2026-06-25',
          },
        ],
        executionRecords: [
          {
            id: 'exec-blocked',
            paymentBatchNo: 'PB-BLOCKED',
            invoiceId: 'inv-1',
            registeredAmount: 300,
            executionStatus: '暂不可登记',
            executionBlockReason: '前序里程碑未付款',
          },
          {
            id: 'exec-overdue',
            paymentBatchNo: 'PB-OVERDUE',
            invoiceId: 'inv-2',
            registeredAmount: 800,
            plannedPaymentDate: '2026-06-25',
            executionStatus: '待登记付款',
          },
        ],
        blockResolutions: [
          {
            id: 'block-1',
            paymentBatchNo: 'PB-BLOCKED',
            blockReason: '前序里程碑未付款',
            resolutionStatus: '处理中',
            nextStep: '补齐里程碑付款',
          },
        ],
        varianceHandlings: [
          {
            id: 'variance-1',
            invoiceId: 'inv-3',
            orderId: 'po-3',
            varianceAmount: 15000,
            status: '待财务经理签核',
            reason: '发票金额高于验收金额',
          },
        ],
        archiveExceptionRequests: [
          {
            id: 'archive-1',
            paymentBatchNo: 'PB-ARCHIVE',
            exceptionType: '凭证缺失',
            approvalStatus: '审批中',
            actionStatus: '待处理',
            closureStatus: '未关闭',
          },
        ],
      },
      '2026-07-01',
    );

    expect(dashboard.summary).toEqual({
      totalExceptions: 4,
      blockedPayments: 1,
      variancePending: 1,
      archivePending: 1,
      overdueRegistrations: 1,
      blockedAmount: 300,
      overdueAmount: 800,
    });
    expect(dashboard.items.map((item) => item.type)).toEqual([
      '付款阻断',
      '差异待处理',
      '归档异常',
      '逾期未登记',
    ]);
    expect(dashboard.items[0]).toMatchObject({
      severity: 'high',
      title: 'PB-BLOCKED',
      amount: 300,
      nextAction: '补齐里程碑付款',
    });
  });

  it('does not include closed or completed records', () => {
    const dashboard = buildFinanceExceptionDashboard(
      {
        paymentBatches: [
          {
            paymentBatchNo: 'PB-DONE',
            registeredCount: 1,
            requestCount: 1,
            registeredAmount: 500,
            plannedPaymentDate: '2026-06-20',
          },
        ],
        executionRecords: [
          {
            id: 'exec-done',
            paymentBatchNo: 'PB-DONE',
            registeredAmount: 500,
            plannedPaymentDate: '2026-06-20',
            executionStatus: '已登记付款',
          },
        ],
        blockResolutions: [{ id: 'block-done', resolutionStatus: '已处理' }],
        varianceHandlings: [{ id: 'variance-done', status: '已处理', varianceAmount: 100 }],
        archiveExceptionRequests: [
          {
            id: 'archive-done',
            approvalStatus: '已通过',
            actionStatus: '已完成',
            closureStatus: '已关闭',
          },
        ],
      },
      '2026-07-01',
    );

    expect(dashboard.summary.totalExceptions).toBe(0);
    expect(dashboard.items).toEqual([]);
  });
});
