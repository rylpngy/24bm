import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface ProjectMilestone {
  key: string;
  title: string;
  dueDate: string | null;
  complete: boolean;
  overdue: boolean;
  evidence: string;
}
export interface ProjectProgress {
  canRework: boolean;
  canStop: boolean;
  packageId: string;
  title: string;
  status: string;
  revision: number;
  milestones: ProjectMilestone[];
  blockers: string[];
}
export interface ProjectAdjustment {
  actorName?: string;
  id: string;
  packageId?: string;
  action: string;
  reason: string;
  snapshot: string;
  releasedAmount: number;
  actorId: string;
  createdAt: string;
}
export const projectMonitor = async (p: string) =>
  (
    await customInstance<
      ApiEnvelope<{
        packages: ProjectProgress[];
        overdueCount: number;
        changesPending: boolean;
        unallocatedAmount: number;
      }>
    >({ url: '/api/v1/buyer/projects/' + encodeURIComponent(p) + '/monitor' })
  ).data!;
export const projectAdjustmentHistory = async (p: string, page: number) =>
  (
    await customInstance<
      ApiEnvelope<{ items: ProjectAdjustment[]; total: number }>
    >({
      url: '/api/v1/buyer/projects/' + encodeURIComponent(p) + '/adjustments',
      params: { page, pageSize: 10 },
    })
  ).data!;
export const projectCloseoutAction = (
  p: string,
  id: string,
  kind: 'rework' | 'stop' | 'milestones',
  data: unknown,
) =>
  customInstance({
    url:
      '/api/v1/buyer/projects/' +
      encodeURIComponent(p) +
      '/packages/' +
      encodeURIComponent(id) +
      '/' +
      kind,
    method: 'POST',
    data,
  });
