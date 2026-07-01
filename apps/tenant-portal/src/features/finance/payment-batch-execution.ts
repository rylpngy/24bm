import type { PaymentExecutionRecordResponse } from '@24bid/api-client';

export type PaymentExecutionRecordWithEvidence = PaymentExecutionRecordResponse & {
  releaseEvidenceNo?: string;
  releaseRemark?: string;
};

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

function toRecordView(record: PaymentExecutionRecordWithEvidence): PaymentBatchExecutionRecordView {
  return {
    id: record.id ?? `${record.paymentBatchNo}:${record.paymentRequestId ?? record.invoiceId ?? 'unknown'}`,
    status: record.executionStatus,
    invoiceId: record.invoiceId,
    paymentRequestId: record.paymentRequestId,
    amount: record.registeredAmount,
    plannedPaymentDate: record.plannedPaymentDate,
    evidence: record.releaseEvidenceNo,
    explanation: record.releaseRemark ?? record.executionBlockReason ?? record.executionTrace,
    nextAction: record.executionNextAction,
  };
}

export function buildPaymentBatchExecutionSummaries(
  executionRecords: PaymentExecutionRecordWithEvidence[],
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
    if (record.executionStatus === '已登记付款') summary.registeredAmount += n(record.registeredAmount);
    if (record.executionStatus === '暂不可登记') summary.blockedAmount += n(record.registeredAmount);
    if (record.executionStatus === '待登记付款') summary.pendingAmount += n(record.registeredAmount);
    summary.records.push(toRecordView(record));
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
