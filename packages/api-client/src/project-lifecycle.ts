import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export type ProjectLifecycleKind = 'carryover' | 'liquidation';
export interface ProjectLifecycleSource {
  departmentId: string;
  period: string;
  sourceType: string;
  sourceId: string;
  pending: number;
  committed: number;
  orderAmount: number;
  paidAmount: number | null;
}
export interface ProjectLifecyclePreview {
  businessPeriod: string;
  effectivePeriod: string;
  amount: number;
  sources: ProjectLifecycleSource[];
  carryoverBlockers: string[];
  liquidationBlockers: string[];
}
export interface ProjectLifecycleRecord {
  id: string;
  projectId: string;
  kind: ProjectLifecycleKind;
  sourcePeriod: string;
  targetPeriod: string;
  projectRevision: number;
  reason: string;
  snapshot: string;
  amount: number;
  status: 'submitted' | 'approved' | 'rejected' | 'withdrawn';
  revision: number;
  workflowInstanceId: string;
  createdBy: string;
  createdAt: string;
  completedBy?: string;
  completedAt?: string;
}
const path = (id: string) =>
  '/api/v1/buyer/projects/' + encodeURIComponent(id) + '/lifecycle';
export const projectLifecyclePreview = async (id: string) =>
  (
    await customInstance<ApiEnvelope<ProjectLifecyclePreview>>({
      url: path(id) + '/preview',
    })
  ).data!;
export const projectLifecycleHistory = async (id: string, page = 1) =>
  (
    await customInstance<
      ApiEnvelope<{
        items: ProjectLifecycleRecord[];
        total: number;
        page: number;
        pageSize: number;
      }>
    >({ url: path(id), params: { page, pageSize: 10 } })
  ).data!;
export const projectLifecycleSubmit = async (
  id: string,
  data: {
    revision: number;
    kind: ProjectLifecycleKind;
    targetPeriod?: string;
    reason: string;
    formData?: Record<string, unknown>;
  },
) =>
  (
    await customInstance<ApiEnvelope<ProjectLifecycleRecord>>({
      url: path(id),
      method: 'POST',
      data,
    })
  ).data!;
export const projectLifecycleWithdraw = (
  project: string,
  id: string,
  revision: number,
  reason: string,
) =>
  customInstance({
    url: path(project) + '/' + encodeURIComponent(id) + '/withdraw',
    method: 'POST',
    data: { revision, reason },
  });
