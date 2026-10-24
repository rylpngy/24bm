import { useMutation, useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
import type { SupplierEvaluationResponse, CreateSupplierEvaluationRequest } from './generated/model';
import type { PerformanceTask as BaseTask, PerformanceTaskDraft as BaseDraft, PerformanceTaskEvaluation } from './performance-tasks';

export const evaluationDimensions = [
  { key: 'qualityScore', weight: 'qualityWeight', label: '质量' },
  { key: 'deliveryScore', weight: 'deliveryWeight', label: '交付' },
  { key: 'priceScore', weight: 'priceWeight', label: '价格' },
  { key: 'serviceScore', weight: 'serviceWeight', label: '服务' },
] as const;
export interface EvaluationWeights { qualityWeight: number; deliveryWeight: number; priceWeight: number; serviceWeight: number }
export interface EvaluationScoring extends EvaluationWeights {
  templateVersionId: string | null; templateId: string | null; templateName: string; version: number;
}
export interface EvaluationTemplateDraft extends EvaluationWeights { name: string }
export interface EvaluationTemplate extends EvaluationTemplateDraft {
  id: string; templateId: string; version: number; enabled: boolean; createdAt: string;
}
export const legacyScoring: EvaluationScoring = {
  templateVersionId: null, templateId: null, templateName: '默认模板', version: 0,
  qualityWeight: 35, deliveryWeight: 30, priceWeight: 20, serviceWeight: 15,
};
export const templateScoring = (template: EvaluationTemplate): EvaluationScoring => ({
  templateVersionId: template.id, templateId: template.templateId, templateName: template.name, version: template.version,
  qualityWeight: template.qualityWeight, deliveryWeight: template.deliveryWeight, priceWeight: template.priceWeight, serviceWeight: template.serviceWeight,
});
export const scoringDescription = (scoring: EvaluationScoring = legacyScoring) =>
  `${scoring.templateName} · v${scoring.version} · ${evaluationDimensions.map(d => `${d.label} ${scoring[d.weight]}%`).join(' / ')}`;
export const validTemplateDraft = (draft: EvaluationTemplateDraft) => !!draft.name.trim() && draft.name.trim().length <= 200
  && evaluationDimensions.every(d => Number.isFinite(draft[d.weight]) && draft[d.weight] >= 0 && draft[d.weight] <= 100)
  && Math.abs(evaluationDimensions.reduce((sum, d) => sum + draft[d.weight], 0) - 100) <= Number.EPSILON * 400;
export const calculateEvaluationTotal = (scores: Record<(typeof evaluationDimensions)[number]['key'], number | string>, weights: EvaluationWeights) =>
  Math.round(evaluationDimensions.reduce((sum, d) => sum + Number(scores[d.key]) * weights[d.weight], 0)) / 100;

const base = '/api/v1/buyer/supplier-evaluation-templates';
export const evaluationTemplatesKey = [base] as const;
export const listEvaluationTemplates = (signal?: AbortSignal) => customInstance<ApiEnvelope<EvaluationTemplate[]>>({ url: base, method: 'GET', signal });
export const useEvaluationTemplates = (enabled = true) => useQuery({ queryKey: evaluationTemplatesKey, queryFn: ({ signal }) => listEvaluationTemplates(signal), enabled });
const writeTemplate = (url: string, data: EvaluationTemplateDraft) =>
  customInstance<ApiEnvelope<EvaluationTemplate>>({ url, method: 'POST', data, headers: { 'Content-Type': 'application/json' } });
export const createEvaluationTemplate = (data: EvaluationTemplateDraft) => writeTemplate(base, data);
export const createEvaluationTemplateVersion = (templateId: string, data: EvaluationTemplateDraft) => writeTemplate(`${base}/${encodeURIComponent(templateId)}/versions`, data);
export const setEvaluationTemplateEnabled = (templateId: string, enabled: boolean) => customInstance<ApiEnvelope<null>>({
  url: `${base}/${encodeURIComponent(templateId)}/enabled`, method: 'PATCH', data: { enabled }, headers: { 'Content-Type': 'application/json' },
});

export interface ScoredSupplierEvaluation extends Omit<SupplierEvaluationResponse, 'scoring'> { scoring?: EvaluationScoring }
export interface ScoredEvaluationDraft extends CreateSupplierEvaluationRequest { templateVersionId?: string }
const supplierBase = (relationId: string) => `/api/v1/buyer/suppliers/${encodeURIComponent(relationId)}`;
export const useScoredSupplierEvaluations = (relationId: string) => useQuery({
  queryKey: [`${supplierBase(relationId)}/evaluations`],
  queryFn: ({ signal }) => customInstance<ApiEnvelope<ScoredSupplierEvaluation[]>>({ url: `${supplierBase(relationId)}/evaluations`, method: 'GET', signal }),
  enabled: !!relationId,
});
export const useCreateScoredSupplierEvaluation = () => useMutation({
  mutationFn: ({ relationId, data }: { relationId: string; data: ScoredEvaluationDraft }) => customInstance<ApiEnvelope<ScoredSupplierEvaluation>>({
    url: `${supplierBase(relationId)}/evaluations`, method: 'POST', data, headers: { 'Content-Type': 'application/json' },
  }),
});
export interface PerformanceTask extends BaseTask { scoring?: EvaluationScoring }
export interface PerformanceTaskDraft extends BaseDraft { templateVersionId?: string }
export type { PerformanceTaskEvaluation };
const taskBase = (relationId: string) => `${supplierBase(relationId)}/performance-tasks`;
export const listBuyerPerformanceTasks = (relationId: string, signal?: AbortSignal) => customInstance<ApiEnvelope<PerformanceTask[]>>({ url: taskBase(relationId), method: 'GET', signal });
export const createPerformanceTask = (relationId: string, data: PerformanceTaskDraft) => customInstance<ApiEnvelope<PerformanceTask>>({ url: taskBase(relationId), method: 'POST', data, headers: { 'Content-Type': 'application/json' } });
export const evaluatePerformanceTask = (relationId: string, taskId: string, data: PerformanceTaskEvaluation) => customInstance<ApiEnvelope<PerformanceTask>>({ url: `${taskBase(relationId)}/${encodeURIComponent(taskId)}/evaluate`, method: 'POST', data, headers: { 'Content-Type': 'application/json' } });
