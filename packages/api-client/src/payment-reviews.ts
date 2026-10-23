import { useMutation, useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';

export interface PaymentReviewRow {
  invoiceId: string; invoiceNo: string; paymentStatus: string; invoiceAmount: number;
  ledgerAmount: number | null; findings: string[]; noteCount: number;
}
export interface PaymentReviewNoteInput {
  idempotencyKey: string; reportedPaidAmount?: number; evidenceReference: string; explanation: string;
}
export interface PaymentReviewNoteRecord extends Omit<PaymentReviewNoteInput, 'reportedPaidAmount'> {
  id: string; reportedPaidAmount?: number | null; snapshot: string; createdBy: string; createdAt: string;
}
export interface PaymentReviewDetail {
  invoice: PaymentReviewRow; notes: PaymentReviewNoteRecord[]; totalNotes: number; page: number; canRecord: boolean;
}
const base = '/api/v1/buyer/payment-reviews';
export function usePaymentReviews(params: { page: number; keyword: string; paymentStatus: string }) {
  return useQuery({ queryKey: [base, params], queryFn: ({ signal }) =>
    customInstance<{ data: { items: PaymentReviewRow[]; total: number; page: number; pageSize: number } }>({ url: base, method: 'GET', params, signal }) });
}
export function usePaymentReview(invoiceId: string, page: number) {
  return useQuery({ queryKey: [base, invoiceId, page], queryFn: ({ signal }) =>
    customInstance<{ data: PaymentReviewDetail }>({ url: `${base}/${encodeURIComponent(invoiceId)}`, method: 'GET', params: { page }, signal }) });
}
export function useRecordPaymentReview(invoiceId: string) {
  return useMutation({ mutationFn: (data: PaymentReviewNoteInput) =>
    customInstance<{ data: PaymentReviewNoteRecord }>({ url: `${base}/${encodeURIComponent(invoiceId)}/notes`, method: 'POST', data }) });
}
