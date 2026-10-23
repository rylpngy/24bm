import type { PaymentBlockResolutionResponse, PaymentExecutionRecordResponse } from '@24bid/api-client';

export interface PaymentBatchExecutionRecordView {
  id: string;
  status?: string;
  invoiceId?: string;
  paymentRequestId?: string;
  amount?: number;
  plannedPaymentDate?: string;
  evidence?: string;
  explanation?: string;
  nextAction?: string;
  resolutionId?: string;
  resolutionStatus?: string;
}

export interface PaymentBatchExecutionSummary {
  totalCount: number;
  registeredAmount: number;
  blockedAmount: number;
  pendingAmount: number;
  records: PaymentBatchExecutionRecordView[];
}

function n(value?: number) {
  return value ?? 0;
}

function statusRank(status?: string) {
  if (status === '暂不可登记') return 0;
  if (status === '待登记付款') return 1;
  if (status === '已登记付款') return 2;
  return 3;
}

function sameOptionalValue(left?: string, right?: string) {
  return !left || !right || left === right;
}

function matchesResolution(record: PaymentExecutionRecordResponse, resolution: PaymentBlockResolutionResponse) {
  return (
    sameOptionalValue(record.paymentBatchNo, resolution.paymentBatchNo) &&
    sameOptionalValue(record.paymentRequestId, resolution.paymentRequestId) &&
    sameOptionalValue(record.invoiceId, resolution.invoiceId) &&
    sameOptionalValue(record.executionBlockReason, resolution.blockReason)
  );
}

function toRecordView(
  record: PaymentExecutionRecordResponse,
  blockResolution?: PaymentBlockResolutionResponse,
): PaymentBatchExecutionRecordView {
  return {
    id: record.id ?? `${record.paymentBatchNo}:${record.paymentRequestId ?? record.invoiceId ?? 'unknown'}`,
    status: record.executionStatus,
    invoiceId: record.invoiceId,
    paymentRequestId: record.paymentRequestId,
    amount: record.registeredAmount,
    plannedPaymentDate: record.plannedPaymentDate,
    evidence: record.releaseEvidenceNo,
    explanation: record.releaseRemark ?? record.executionBlockReason ?? blockResolution?.blockReason ?? record.executionTrace,
    nextAction: blockResolution?.nextStep ?? record.executionNextAction,
    resolutionId: blockResolution?.id,
    resolutionStatus: blockResolution?.resolutionStatus,
  };
}

export function buildPaymentBatchExecutionSummaries(
  executionRecords: PaymentExecutionRecordResponse[],
  blockResolutions: PaymentBlockResolutionResponse[] = [],
): Map<string, PaymentBatchExecutionSummary> {
  const summaries = new Map<string, PaymentBatchExecutionSummary>();

  for (const record of executionRecords) {
    if (!record.paymentBatchNo) continue;
    const summary = summaries.get(record.paymentBatchNo) ?? {
      totalCount: 0,
      registeredAmount: 0,
      blockedAmount: 0,
      pendingAmount: 0,
      records: [],
    };

    summary.totalCount += 1;
    summary.registeredAmount += n(record.registeredAmount);
    const blockResolution = blockResolutions.find((resolution) => matchesResolution(record, resolution));
    summary.records.push(toRecordView(record, blockResolution));
    summaries.set(record.paymentBatchNo, summary);
  }

  for (const summary of summaries.values()) {
    summary.records.sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return (b.amount ?? 0) - (a.amount ?? 0);
    });
  }

  return summaries;
}
