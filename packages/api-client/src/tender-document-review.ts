import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface TenderDocumentReview {
  id: string; status: 'processing' | 'approved' | 'rejected';
  requestedBy: string; completedBy?: string; comment?: string; createdAt: string;
}
export interface TenderDocumentReviewState { reviews: TenderDocumentReview[]; currentApproved: boolean }
export const tenderDocumentReviews = (id: string) => customInstance<ApiEnvelope<TenderDocumentReviewState>>({ url: `/api/v1/buyer/tenders/${encodeURIComponent(id)}/document-reviews`, method: 'GET' });
export const submitTenderDocumentReview = (id: string, formData: Record<string, unknown>) => customInstance<ApiEnvelope<TenderDocumentReviewState>>({ url: `/api/v1/buyer/tenders/${encodeURIComponent(id)}/document-reviews`, method: 'POST', data: { formData } });
