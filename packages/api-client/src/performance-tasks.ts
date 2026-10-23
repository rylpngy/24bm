import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

// Handwritten contract alongside the generated client, following workflow-runtime.
export type PerformanceTaskStatus = 'assigned' | 'evaluated' | 'remediation_requested' | 'remediation_submitted' | 'closed';
export interface PerformanceTask {
  id: string;
  version: number;
  relationId: string;
  supplierName: string;
  buyerName: string;
  period: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  status: PerformanceTaskStatus;
  evaluationId?: string;
  totalScore?: number;
  requirement?: string;
  response?: string;
  history: { action: string; actorName: string; comment: string; createdAt: string }[];
}
export interface PerformanceTaskDraft { period: string; assigneeId: string; dueDate: string }
export interface PerformanceTaskEvaluation {
  qualityScore: number; deliveryScore: number; priceScore: number; serviceScore: number; comment: string;
}
const buyerBase = (relationId: string) => `/api/v1/buyer/suppliers/${encodeURIComponent(relationId)}`;
export const buyerPerformanceTasksKey = (relationId: string) => [`${buyerBase(relationId)}/performance-tasks`] as const;
export const supplierPerformanceTasksKey = ['/api/v1/supplier/performance-tasks'] as const;
export const listBuyerPerformanceTasks = (relationId: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<PerformanceTask[]>>({ url: buyerPerformanceTasksKey(relationId)[0], method: 'GET', signal });
export const listPerformanceAssignees = (relationId: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<{ id: string; displayName: string }[]>>({ url: `${buyerBase(relationId)}/performance-assignees`, method: 'GET', signal });
const postTask = (url: string, data: unknown) => customInstance<ApiEnvelope<PerformanceTask>>({
  url, method: 'POST', headers: { 'Content-Type': 'application/json' }, data,
});
export const createPerformanceTask = (relationId: string, data: PerformanceTaskDraft) =>
  postTask(buyerPerformanceTasksKey(relationId)[0], data);
export const evaluatePerformanceTask = (relationId: string, taskId: string, data: PerformanceTaskEvaluation) =>
  postTask(`${buyerPerformanceTasksKey(relationId)[0]}/${encodeURIComponent(taskId)}/evaluate`, data);
export const requestPerformanceRemediation = (relationId: string, taskId: string, data: { requirement: string; dueDate: string }) =>
  postTask(`${buyerPerformanceTasksKey(relationId)[0]}/${encodeURIComponent(taskId)}/request-remediation`, data);
export const reviewPerformanceTask = (relationId: string, taskId: string, data: { approved: boolean; comment: string; expectedVersion: number }) =>
  postTask(`${buyerPerformanceTasksKey(relationId)[0]}/${encodeURIComponent(taskId)}/review`, data);
export const listSupplierPerformanceTasks = (signal?: AbortSignal) =>
  customInstance<ApiEnvelope<PerformanceTask[]>>({ url: supplierPerformanceTasksKey[0], method: 'GET', signal });
export const respondPerformanceTask = (taskId: string, data: { response: string; expectedVersion: number }) =>
  postTask(`${supplierPerformanceTasksKey[0]}/${encodeURIComponent(taskId)}/response`, data);
