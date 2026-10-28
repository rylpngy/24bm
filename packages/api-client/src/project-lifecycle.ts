import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export type ProjectLifecycleKind = 'carryover' | 'liquidation' | 'reopen';
export interface ProjectReopenPreview {
  projectStatus: string;
  packageId?: string;
  period: string;
  restoreAmount: number;
  funds: {
    fundId: string;
    name: string;
    revision: number;
    restoreAmount: number;
  }[];
  packages: { id: string; title: string; revision: number }[];
  blockers: string[];
}
export const projectReopenPreview = async (id: string, packageId?: string) =>
  (
    await customInstance<ApiEnvelope<ProjectReopenPreview>>({
      url: path(id) + '/reopen-preview',
      params: packageId ? { packageId } : undefined,
    })
  ).data!;
export const projectReopenArchive = (project: string, id: string) =>
  customInstance<Blob>({
    url: path(project) + '/' + encodeURIComponent(id) + '/closure-archive',
    responseType: 'blob',
  });
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
  fundingEnabled?: boolean;
  businessPeriod: string;
  effectivePeriod: string;
  amount: number;
  paidAmount: number | null;
  transferAmount: number | null;
  payments: {
    id: string;
    invoiceId: string;
    orderId: string;
    rfqId: string;
    amount: number;
    evidenceNo: string;
  }[];
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
    fundingSources?: { sourceFundId: string; targetFundId: string }[];
    packageId?: string;
    packageRevision?: number;
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
