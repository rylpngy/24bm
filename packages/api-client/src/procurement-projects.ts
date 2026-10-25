import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface ProcProject {
  id: string;
  projectNo: string;
  title: string;
  departmentId: string;
  departmentName: string;
  ownerId: string;
  ownerName: string;
  period: string;
  fundingSource: string;
  purpose: string;
  plannedAmount: number;
  status: string;
  revision: number;
  createdBy: string;
  workflowInstanceId?: string;
  executionType?: 'rfq' | 'tender';
  executionId?: string;
  closeoutReason?: string;
}
export interface ProcProjectLine {
  id?: string;
  materialId: string;
  name?: string;
  specification?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  purpose: string;
}
export interface ProcProjectDraft {
  title: string;
  departmentId: string;
  ownerId: string;
  period: string;
  fundingSource: string;
  purpose: string;
  lines: ProcProjectLine[];
  revision: number;
}
export interface ProcProjectDetail {
  project: ProcProject;
  lines: ProcProjectLine[];
}
export interface ProcProjectDemand {
  id: string;
  title: string;
  status: string;
  budget: number;
  departmentId: string;
  requesterId: string;
  period: string;
}
export interface ProcProjectExecution {
  demands: ProcProjectDemand[];
  documents: Array<{
    type: string;
    id: string;
    title: string;
    status: string;
    amount?: number;
    module: string;
    recordId: string;
  }>;
  demandAmount: number;
  orderAmount: number;
  invoicedAmount: number;
  paidAmount: number | null;
  warnings: string[];
  canClose: boolean;
}
export interface ProcProjectBudget {
  configured: boolean;
  totalAmount: number;
  pending: number;
  committed: number;
  paidAmount: number;
  period: string;
}
async function call<T>(
  path: string,
  data?: unknown,
  method = data === undefined ? 'GET' : 'POST',
) {
  return (
    await customInstance<ApiEnvelope<T>>({
      url: '/api/v1/buyer/projects' + path,
      method,
      data,
    })
  ).data as T;
}
export const projectList = (page: number, status: string, keyword: string) =>
  call<{ items: ProcProject[]; total: number; page: number; pageSize: number }>(
    `?page=${page}&pageSize=10&status=${encodeURIComponent(status)}&keyword=${encodeURIComponent(keyword)}`,
  );
export const projectDetail = (id: string) =>
  call<ProcProjectDetail>('/' + encodeURIComponent(id));
export const projectSave = (data: ProcProjectDraft, id?: string) =>
  call<ProcProjectDetail>(
    id ? '/' + encodeURIComponent(id) : '',
    data,
    id ? 'PUT' : 'POST',
  );
export const projectAction = (
  id: string,
  action: 'submit' | 'withdraw' | 'terminate' | 'close' | 'create-demand',
  revision: number,
  reason: string,
  formData: Record<string, unknown> = {},
) =>
  call<ProcProjectDetail>(`/${encodeURIComponent(id)}/${action}`, {
    revision,
    reason,
    formData,
  });
export const projectLinkDemand = (
  id: string,
  revision: number,
  demandId: string,
) =>
  call<ProcProjectDetail>(`/${encodeURIComponent(id)}/demands`, {
    revision,
    demandId,
  });
export const projectDemands = (id: string) =>
  call<ProcProjectDemand[]>(`/${encodeURIComponent(id)}/demands`);
export const projectCreateExecution = (
  id: string,
  revision: number,
  type: 'rfq' | 'tender',
) =>
  call<ProcProjectDetail>(`/${encodeURIComponent(id)}/execution`, {
    revision,
    type,
  });
export const projectExecution = (id: string) =>
  call<ProcProjectExecution>(`/${encodeURIComponent(id)}/execution`);
export const projectBudget = (id: string) =>
  call<ProcProjectBudget>(`/${encodeURIComponent(id)}/budget`);
export const projectOptions = () =>
  call<{
    departments: Array<{
      id: string;
      name: string;
      departmentId: string;
      status: string;
    }>;
    users: Array<{
      id: string;
      name: string;
      departmentId: string;
      status: string;
    }>;
  }>('/options');
