import { useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export interface ProcurementDocument {
  id: string; label: string; status: string; amount: number | null; module: string; recordId: string;
}
export interface ProcurementArchive {
  id: string; createdAt: string; createdBy: string; sha256: string; stale: boolean;
}
export interface ProcurementExecution {
  rfqId: string; title: string; status: string; documents: ProcurementDocument[];
  budgetAmount: number; orderAmount: number; invoicedAmount: number;
  paidAmount: number | null; remainingAmount: number | null;
  blockers: string[]; canArchive: boolean; archives: ProcurementArchive[];
}
export const procurementExecutionUrl = (rfqId: string) => `/api/v1/buyer/rfqs/${encodeURIComponent(rfqId)}/execution`;
export const procurementExecutionKey = (rfqId: string) => [procurementExecutionUrl(rfqId)] as const;
export const useProcurementExecution = (rfqId: string, enabled = true) => useQuery({
  queryKey: procurementExecutionKey(rfqId), enabled: enabled && !!rfqId,
  queryFn: ({ signal }) => customInstance<ApiEnvelope<ProcurementExecution>>({ url: procurementExecutionUrl(rfqId), method: 'GET', signal }),
});
export const createProcurementArchive = (rfqId: string, remark: string) => customInstance<ApiEnvelope<ProcurementArchive>>({
  url: `${procurementExecutionUrl(rfqId)}/archives`, method: 'POST', data: { remark }, headers: { 'Content-Type': 'application/json' },
});
