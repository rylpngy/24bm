import { useMutation, useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ContractPaymentMilestoneResponse } from './generated/model';

export interface MonetaryContractMilestone extends Omit<ContractPaymentMilestoneResponse, 'paidAmount' | 'remainingAmount'> {
  paidAmount?: number | null; remainingAmount?: number | null; paymentVerified?: boolean;
}
export function useMonetaryContractMilestones(contractId: string) {
  return useQuery({ queryKey: [`/api/v1/buyer/contracts/${contractId}/payment-milestones`], queryFn: ({ signal }) =>
    customInstance<{ data: MonetaryContractMilestone[] }>({ url: `/api/v1/buyer/contracts/${encodeURIComponent(contractId)}/payment-milestones`, method: 'GET', signal }) });
}

export interface PaymentAmountEntry {
  id: string; amount: number; milestoneId?: string; evidenceNo: string; remark: string;
  reversalOf?: string; createdBy: string; createdAt: string;
}
export interface PaymentLedgerSummary {
  invoiceAmount: number; paidAmount: number | null; remainingAmount: number | null;
  reconciliationRequired: boolean; warning: string; entries: PaymentAmountEntry[];
  frozenEntryIds?: string[];
  funding?: {enabled:boolean;blocker:string;sources:{fundId:string;code:string;name:string;allocatedAmount:number;paidAmount:number;remainingAmount:number}[];entries:{entryId:string;fundId:string;code:string;amount:number;evidenceNo:string;createdBy:string;createdAt:string}[]}|null;
  milestones: { id: string; name: string; amount: number; paid: number | null; remaining: number | null; reached: boolean; verified: boolean }[];
}
export interface RecordPaymentAmount {
  idempotencyKey: string; amount: number; milestoneId?: string; evidenceNo: string; remark?: string;
  fundingLines?:{fundId:string;amount:number}[];
}
const url = (id: string) => `/api/v1/buyer/invoices/${encodeURIComponent(id)}/payment-ledger`;
export function usePaymentLedger(invoiceId: string) {
  return useQuery({ queryKey: [url(invoiceId)], queryFn: ({ signal }) =>
    customInstance<{ data: PaymentLedgerSummary }>({ url: url(invoiceId), method: 'GET', signal }) });
}
export function useRecordPaymentAmount(invoiceId: string) {
  return useMutation({ mutationFn: (data: RecordPaymentAmount) =>
    customInstance<{ data: PaymentLedgerSummary }>({ url: url(invoiceId), method: 'POST', data }) });
}
export function useReversePayment(invoiceId: string) {
  return useMutation({ mutationFn: ({ entryId, ...data }: { entryId: string; idempotencyKey: string; reason: string }) =>
    customInstance<{ data: PaymentLedgerSummary }>({ url: `${url(invoiceId)}/${encodeURIComponent(entryId)}/reverse`, method: 'POST', data }) });
}
