import type {
  ContractPaymentMilestoneResponse,
  ContractResponse,
  PaymentBatchResponse,
  PaymentExecutionRecordResponse,
  PaymentRequestResponse,
} from '@24bid/api-client';

export type ReconciliationStatus =
  | '待建立付款申请'
  | '存在付款阻断'
  | '已完成付款登记'
  | '里程碑达成待付款'
  | '付款申请未覆盖合同'
  | '对账正常';

export interface ContractPaymentReconciliationInput {
  contract: ContractResponse;
  milestones: ContractPaymentMilestoneResponse[];
  paymentRequests: PaymentRequestResponse[];
  paymentBatches: PaymentBatchResponse[];
  executionRecords: PaymentExecutionRecordResponse[];
}

export interface ContractPaymentReconciliation {
  contractAmount: number;
  milestoneAmount: number;
  milestonePaidAmount: number;
  reachedUnpaidAmount: number;
  paymentRequestCount: number;
  paymentRequestAmount: number;
  approvedRequestAmount: number;
  paymentBatchNos: string[];
  batchCount: number;
  registeredAmount: number;
  blockedCount: number;
  blockReasons: string[];
  unrequestedContractAmount: number;
  unregisteredContractAmount: number;
  status: ReconciliationStatus;
}

const n = (value?: number) => value ?? 0;

const unique = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export function buildContractPaymentReconciliation({
  contract,
  milestones,
  paymentRequests,
  paymentBatches,
  executionRecords,
}: ContractPaymentReconciliationInput): ContractPaymentReconciliation {
  const contractAmount = n(contract.amount);
  const relatedRequests = paymentRequests.filter(
    (request) => Boolean(contract.relatedOrderId) && request.orderId === contract.relatedOrderId,
  );
  const requestIds = new Set(unique(relatedRequests.map((request) => request.id)));
  const paymentBatchNos = unique(relatedRequests.map((request) => request.paymentBatchNo));
  const batchNoSet = new Set(paymentBatchNos);
  const relatedBatches = paymentBatches.filter((batch) => batch.paymentBatchNo && batchNoSet.has(batch.paymentBatchNo));
  const relatedExecutions = executionRecords.filter(
    (record) =>
      (record.paymentRequestId && requestIds.has(record.paymentRequestId)) ||
      (record.paymentBatchNo && batchNoSet.has(record.paymentBatchNo)),
  );

  const milestoneAmount = milestones.reduce((sum, milestone) => sum + n(milestone.amount), 0);
  const milestonePaidAmount = milestones
    .filter((milestone) => milestone.status === '已付')
    .reduce((sum, milestone) => sum + n(milestone.amount), 0);
  const reachedUnpaidAmount = milestones
    .filter((milestone) => milestone.reached && milestone.status !== '已付')
    .reduce((sum, milestone) => sum + n(milestone.amount), 0);
  const paymentRequestAmount = relatedRequests.reduce((sum, request) => sum + n(request.amount), 0);
  const approvedRequestAmount = relatedRequests
    .filter((request) => request.requestStatus === '付款申请已通过')
    .reduce((sum, request) => sum + n(request.amount), 0);
  const registeredAmount = relatedExecutions
    .filter((record) => record.executionStatus === '已登记付款')
    .reduce((sum, record) => sum + n(record.registeredAmount), 0);
  const executionBlockedCount = relatedExecutions.filter((record) => record.executionStatus === '暂不可登记').length;
  const batchBlockedCount = relatedBatches.reduce((sum, batch) => sum + n(batch.blockedRegistrationCount), 0);
  const blockReasons = unique(
    relatedExecutions
      .filter((record) => record.executionStatus === '暂不可登记')
      .map((record) => record.executionBlockReason),
  );
  const blockedCount = Math.max(executionBlockedCount, batchBlockedCount);
  const unrequestedContractAmount = Math.max(contractAmount - paymentRequestAmount, 0);
  const unregisteredContractAmount = Math.max(contractAmount - registeredAmount, 0);

  let status: ReconciliationStatus = '对账正常';
  if (relatedRequests.length === 0) {
    status = '待建立付款申请';
  } else if (blockedCount > 0) {
    status = '存在付款阻断';
  } else if (contractAmount > 0 && registeredAmount >= contractAmount) {
    status = '已完成付款登记';
  } else if (reachedUnpaidAmount > 0) {
    status = '里程碑达成待付款';
  } else if (paymentRequestAmount < contractAmount) {
    status = '付款申请未覆盖合同';
  }

  return {
    contractAmount,
    milestoneAmount,
    milestonePaidAmount,
    reachedUnpaidAmount,
    paymentRequestCount: relatedRequests.length,
    paymentRequestAmount,
    approvedRequestAmount,
    paymentBatchNos,
    batchCount: relatedBatches.length,
    registeredAmount,
    blockedCount,
    blockReasons,
    unrequestedContractAmount,
    unregisteredContractAmount,
    status,
  };
}
