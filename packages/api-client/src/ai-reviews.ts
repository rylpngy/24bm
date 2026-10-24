import { axiosInstance } from './http-client';

export type AiSubjectType = 'demand' | 'attachment' | 'supplier' | 'procurement_risk';
export type AiDisposition = 'adopted' | 'dismissed' | 'needs_review';
export interface AiReviewEvidence {
  id: string; kind: string; locator: string; label: string; value: unknown;
  sourceId?: string; sourceHash?: string; policyVersion?: string;
}
export interface AiReviewFinding {
  id: string; severity: string; title: string; detail: string; evidenceIds: string[];
}
export interface AiReviewFeedback {
  findingId: string; disposition: AiDisposition; comment?: string; createdAt?: string; createdBy?: string;
}
export interface AiReviewRun {
  runId: string; subjectType: AiSubjectType; subjectId: string; sourceRevision: string;
  createdAt: string; mode: string; model?: string; fallbackReason?: string;
  rulesetVersion: string; summary: string; findings: AiReviewFinding[];
  evidence: AiReviewEvidence[]; limitations: string[]; feedback: AiReviewFeedback[];
}
interface Envelope<T> { data: T }
export interface AiPolicyVersion {
  id: string; policyKey: string; title: string; version: number; subjectTypes: AiSubjectType[];
  clauses: AiPolicyClause[]; status: 'draft' | 'published' | 'retired';
  sourceHash: string; createdAt: string; createdBy: string;
}
export interface AiPolicyClause { id: string; title: string; text: string }
export interface AiPolicyDraft { policyKey: string; title: string; subjectTypes: AiSubjectType[]; clauses: AiPolicyClause[]; expectedLatestVersion: number }
export async function listAiPolicies(signal?: AbortSignal) {
  return (await axiosInstance.get<Envelope<AiPolicyVersion[]>>('/api/v1/buyer/ai/policies', { signal })).data.data;
}
export async function createAiPolicy(policy: AiPolicyDraft) {
  return (await axiosInstance.post<Envelope<AiPolicyVersion>>('/api/v1/buyer/ai/policies', policy)).data.data;
}
export async function transitionAiPolicy(policyId: string, action: 'publish' | 'retire') {
  return (await axiosInstance.post<Envelope<AiPolicyVersion>>(`/api/v1/buyer/ai/policies/${encodeURIComponent(policyId)}/${action}`)).data.data;
}
const endpoint = '/api/v1/buyer/ai/reviews';
export async function listAiReviews(subjectType: AiSubjectType, subjectId: string, signal?: AbortSignal) {
  return (await axiosInstance.get<Envelope<AiReviewRun[]>>(endpoint, { params: { subjectType, subjectId }, signal })).data.data;
}
export async function getAiReview(runId: string, signal?: AbortSignal) {
  return (await axiosInstance.get<Envelope<AiReviewRun>>(`${endpoint}/${encodeURIComponent(runId)}`, { signal })).data.data;
}
export async function createAiReview(subjectType: AiSubjectType, subjectId: string, expectedRevision?: string) {
  return (await axiosInstance.post<Envelope<AiReviewRun>>(endpoint, { subjectType, subjectId, ...(expectedRevision ? { expectedRevision } : {}) })).data.data;
}
export async function saveAiFeedback(runId: string, feedback: AiReviewFeedback) {
  return (await axiosInstance.post<Envelope<unknown>>(`${endpoint}/${encodeURIComponent(runId)}/feedback`, feedback)).data.data;
}
