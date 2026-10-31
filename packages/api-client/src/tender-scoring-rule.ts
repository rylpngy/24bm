import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface TenderScoringWeights { technical: number; commercial: number; price: number }
export interface TenderScoringRuleView {
  evaluationMethod: string; revision: number; weights: TenderScoringWeights;
  history: Array<{ revision: number; technicalWeight: number; commercialWeight: number; priceWeight: number; reason: string; createdBy: string; createdAt: string }>;
}
export interface SaveTenderScoringRule { technicalWeight: number; commercialWeight: number; priceWeight: number; reason: string; expectedRevision: number }
export const tenderScoringRule = (id: string) => customInstance<ApiEnvelope<TenderScoringRuleView>>({ url: `/api/v1/buyer/tenders/${encodeURIComponent(id)}/scoring-rule`, method: 'GET' });
export const saveTenderScoringRule = (id: string, data: SaveTenderScoringRule) => customInstance<ApiEnvelope<TenderScoringRuleView>>({ url: `/api/v1/buyer/tenders/${encodeURIComponent(id)}/scoring-rule`, method: 'PUT', data });
export const supplierTenderScoringRule = (id: string) => customInstance<ApiEnvelope<Pick<TenderScoringRuleView,'evaluationMethod'|'revision'|'weights'>>>({ url: `/api/v1/supplier/tenders/${encodeURIComponent(id)}/scoring-rule`, method: 'GET' });
