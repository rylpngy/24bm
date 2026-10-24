import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface QualReviewAttempt { id: string; tenantId: string; reviewId: number; workflowInstanceId: string; reason: string; status: string; createdBy: string; createdAt: string; completedAt?: string }
export interface QualSupplementItem { id: string; tenantId: string; relationId: string; qualificationId: string; reason: string; dueDate: string; status: string; revision: number; response?: string; replacementId?: string; supplierId: string; supplierName: string; tenantName: string; qualificationType: string; createdAt: string }
export interface QualPage<T> { items: T[]; total: number; page: number; pageSize: number }
async function call<T>(url: string, data?: unknown, method = data === undefined ? 'GET' : 'POST') {
  return (await customInstance<ApiEnvelope<T>>({ url: '/api/v1/' + url, method, data })).data as T;
}
export const qualificationAttempts = (id: number, page: number) => call<QualPage<QualReviewAttempt>>(`buyer/suppliers/qualification-reviews/${id}/workflows?page=${page}&pageSize=10`);
export const startQualificationWorkflow = (id: number, reason: string, formData: Record<string, unknown>) => call<QualReviewAttempt>(`buyer/suppliers/qualification-reviews/${id}/workflows`, { reason, formData });
export const cancelQualificationWorkflow = (id: string, reason: string) => call<void>(`buyer/suppliers/qualification-workflows/${encodeURIComponent(id)}/cancel`, { reason });
export const qualificationSupplements = (scope: 'buyer' | 'supplier', page: number, relationId = '') => call<QualPage<QualSupplementItem>>(`${scope === 'buyer' ? 'buyer/suppliers/qualification-supplements' : 'supplier/qualifications/supplements'}?page=${page}&pageSize=10&relationId=${encodeURIComponent(relationId)}`);
export const requestQualificationSupplement = (data: { relationId: string; qualificationId: string; reason: string; dueDate: string }) => call<QualSupplementItem>('buyer/suppliers/qualification-supplements', data);
export const replyQualificationSupplement = (id: string, data: { replacementId: string; response: string; revision: number }) => call<QualSupplementItem>(`supplier/qualifications/supplements/${encodeURIComponent(id)}/reply`, data);
export const cancelQualificationSupplement = (id: string, data: { reason: string; revision: number }) => call<void>(`buyer/suppliers/qualification-supplements/${encodeURIComponent(id)}/cancel`, data);
