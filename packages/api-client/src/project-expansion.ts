import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
import type {
  ProcProjectDraft,
  ProcProjectLine,
  ProcProjectDemand,
  ProcProjectExecution,
} from './procurement-projects';
export interface ProjectRun {
  id: string;
  projectId: string;
  packageId: string;
  executionType: 'rfq' | 'tender';
  executionId: string;
  status: 'active' | 'abandoned';
  reason: string;
  createdBy: string;
  createdAt: string;
}
export interface ProjectPackage {
  info: {
    id: string;
    projectId: string;
    title: string;
    status: 'draft' | 'ready' | 'closed' | 'cancelled';
    revision: number;
    projectRevision: number;
    amount: number;
    snapshot: string;
    createdAt: string;
  };
  lines: ProcProjectLine[];
  demands: ProcProjectDemand[];
  runs: ProjectRun[];
  sourceStatuses: Record<string, string>;
  sourceMethods?: Record<string, string>;
}
export const projectPackageBalances = (p: string) =>
  call<
    Array<{
      materialId: string;
      approved: number;
      allocated: number;
      remaining: number;
    }>
  >(p, '/package-balances');
export interface ProjectChange {
  id: string;
  projectId: string;
  basedRevision: number;
  beforeSnapshot: string;
  proposal: string;
  amount: number;
  reason: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'withdrawn';
  revision: number;
  workflowInstanceId?: string;
  resultRevision?: number;
  createdBy: string;
  createdAt: string;
}
async function call<T>(
  p: string,
  path: string,
  data?: unknown,
  method = data === undefined ? 'GET' : 'POST',
) {
  return (
    await customInstance<ApiEnvelope<T>>({
      url: `/api/v1/buyer/projects/${encodeURIComponent(p)}` + path,
      method,
      data,
    })
  ).data as T;
}
export const projectPackages = (p: string) =>
  call<ProjectPackage[]>(p, '/packages');
export const projectPackageSave = (
  p: string,
  data: {
    projectRevision: number;
    revision: number;
    title: string;
    lines: Array<{ materialId: string; quantity: number }>;
    demandIds: string[];
  },
  id?: string,
) =>
  call<ProjectPackage>(
    p,
    '/packages' + (id ? '/' + encodeURIComponent(id) : ''),
    data,
    id ? 'PUT' : 'POST',
  );
export const projectPackageAction = (
  p: string,
  id: string,
  action: 'cancel' | 'create-demand' | 'close',
  revision: number,
  reason: string,
) =>
  call<ProjectPackage>(p, `/packages/${encodeURIComponent(id)}/${action}`, {
    revision,
    reason,
  });
export const projectPackageExecute = (
  p: string,
  id: string,
  revision: number,
  type: 'rfq' | 'tender' | 'auction',
  reason: string,
  retry = false,
  auction?: {
    startPrice?: number;
    minDecrement?: number;
    startsAt?: string;
    deadlineAt?: string;
    softCloseTriggerMinutes?: number;
    softCloseExtendMinutes?: number;
  },
) =>
  call<ProjectPackage>(
    p,
    `/packages/${encodeURIComponent(id)}/${retry ? 'retry' : 'execution'}`,
    { revision, type, reason, ...auction },
  );
export const projectPackageLink = (
  p: string,
  id: string,
  revision: number,
  demandId: string,
) =>
  call<ProjectPackage>(p, `/packages/${encodeURIComponent(id)}/demands`, {
    revision,
    demandId,
  });
export const projectPackageExecution = (p: string, id: string) =>
  call<ProcProjectExecution>(
    p,
    `/packages/${encodeURIComponent(id)}/execution`,
  );
export const projectChanges = (p: string, page = 1) =>
  call<{
    items: ProjectChange[];
    total: number;
    page: number;
    pageSize: number;
    pending: boolean;
    hasOpenChange: boolean;
  }>(p, `/changes?page=${page}&pageSize=10`);
export const projectChange = (p: string, id: string) =>
  call<ProjectChange>(p, `/changes/${encodeURIComponent(id)}`);
export const projectChangeSave = (
  p: string,
  data: {
    projectRevision: number;
    revision: number;
    reason: string;
    proposal: ProcProjectDraft;
  },
  id?: string,
) =>
  call<ProjectChange>(
    p,
    '/changes' + (id ? '/' + encodeURIComponent(id) : ''),
    data,
    id ? 'PUT' : 'POST',
  );
export const projectChangeAction = (
  p: string,
  id: string,
  action: 'submit' | 'withdraw',
  revision: number,
  reason: string,
  formData: Record<string, unknown> = {},
) =>
  call<ProjectChange>(p, `/changes/${encodeURIComponent(id)}/${action}`, {
    revision,
    reason,
    formData,
  });
