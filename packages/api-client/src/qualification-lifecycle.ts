import { supplierQualificationReplace, supplierQualificationHistory as fetchHistory } from './generated/supplier-qualification-controller/supplier-qualification-controller';
import { buyerSupplierQualificationArchive } from './generated/buyer-supplier-controller/buyer-supplier-controller';
import type { CreateSupplierQualificationRequest, SupplierQualificationResponse } from './generated/model';
import { qualificationReviewBuyerReviews, qualificationReviewSupplierReviews, qualificationReviewReview } from './generated/qualification-review-controller/qualification-review-controller';

export interface QualificationReview {
  id: number;
  relationId: string;
  qualificationId: string;
  previousId: string;
  qualificationType: string;
  supplierName: string;
  tenantName: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  comment?: string;
  actorId?: string;
  createdAt: string;
  reviewedAt?: string;
}
export async function qualificationReviews(scope: 'buyer' | 'supplier'): Promise<QualificationReview[]> {
  const response = await (scope === 'buyer' ? qualificationReviewBuyerReviews() : qualificationReviewSupplierReviews());
  return (response.data ?? []) as QualificationReview[];
}
export async function decideQualificationReview(id: number, approved: boolean, comment: string): Promise<void> {
  await qualificationReviewReview(id, { approved, comment });
}

export interface QualificationEvent {
  qualificationId: string;
  replacementId?: string;
  action: string;
  actorId: string;
  createdAt: string;
}

export async function replaceSupplierQualification(id: string, data: CreateSupplierQualificationRequest) {
  return supplierQualificationReplace(id, data);
}

export async function supplierQualificationHistory(): Promise<QualificationEvent[]> {
  return (await fetchHistory()).data as unknown as QualificationEvent[];
}

export async function buyerQualificationArchive(relationId: string): Promise<SupplierQualificationResponse[]> {
  return (await buyerSupplierQualificationArchive(relationId)).data ?? [];
}
