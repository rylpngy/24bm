import { useMutation, useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export interface BudgetPoolPosition {
  departmentId: string; departmentName: string; period: string; totalAmount: number; version: number;
  pending: number; committed: number; orderAmount: number; paidAmount: number | null; releasedAmount: number; configured: boolean;
}
export interface BudgetRequestItem {
  id: string; departmentId: string; period: string; kind: 'initial' | 'adjustment' | 'exception';
  title: string; reason: string; targetAmount: number; baseAmount: number; baseVersion: number; revision: number;
  targetType?: string | null; targetId?: string | null; status: string; createdBy: string;
  workflowInstanceId?: string; approvedBy?: string; approvedAt?: string; expiresAt?: string;
  consumedAt?: string; createdAt?: string; updatedAt?: string;
}
export interface BudgetDraftInput {
  departmentId: string; period: string; kind: BudgetRequestItem['kind']; targetAmount: number;
  title: string; reason: string; revision: number; targetType?: string | null; targetId?: string | null;
}
export interface BudgetControlPolicy {
  mode: 'warning' | 'approval' | 'hard'; revision: number; reason: string;
  updatedBy?: string; updatedAt?: string; unassignedOrderCount: number; invalidDemandCount: number; canConfigure: boolean;
}
export interface BudgetCommitmentLine {
  departmentId: string; period: string; sourceType: string; sourceId: string; label: string;
  pending: number; committed: number; orderAmount: number; paidAmount: number | null; releasedAmount: number;
}
export interface BudgetMissingOrder { id: string; rfqId: string; amount: number; status: string; createdAt?: string }
interface BudgetPage<T> { items: T[]; total: number; page: number; pageSize: number }
const root = '/api/v1/buyer/budgets';
const get = <T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<T>>({ url: root + path, method: 'GET', params, signal });
export const useBudgetPoolPositions = () => useQuery({ queryKey: [root, 'positions'], queryFn: ({ signal }) => get<BudgetPoolPosition[]>('/positions', undefined, signal) });
export const useBudgetDepartments = () => useQuery({ queryKey: [root, 'departments'], queryFn: ({ signal }) => get<Array<{ id: string; name: string }>>('/departments', undefined, signal) });
export const useBudgetControlPolicy = () => useQuery({ queryKey: [root, 'policy'], queryFn: ({ signal }) => get<BudgetControlPolicy>('/policy', undefined, signal) });
export const useBudgetChangeRequests = (kind: string, page: number) => useQuery({ queryKey: [root, 'requests', kind, page], queryFn: ({ signal }) => get<BudgetPage<BudgetRequestItem>>('/requests', { kind, page, pageSize: 20 }, signal) });
export const useBudgetChangeRequest = (id?: string) => useQuery({ queryKey: [root, 'requests', id], queryFn: ({ signal }) => get<BudgetRequestItem>('/requests/' + encodeURIComponent(id!), undefined, signal), enabled: Boolean(id) });
export const useBudgetCommitments = (departmentId: string, period: string, page: number) => useQuery({ queryKey: [root, 'ledger', departmentId, period, page], queryFn: ({ signal }) => get<BudgetPage<BudgetCommitmentLine>>('/ledger', { departmentId, period, page, pageSize: 20 }, signal) });
export const useBudgetMissingOrders = (enabled: boolean, page = 1) => useQuery({ queryKey: [root, 'unassigned-orders', page], queryFn: ({ signal }) => get<BudgetPage<BudgetMissingOrder>>('/unassigned-orders', { page, pageSize: 20 }, signal), enabled });
type BudgetMutation =
  | { action: 'create'; data: BudgetDraftInput }
  | { action: 'edit'; id: string; data: BudgetDraftInput }
  | { action: 'submit'; id: string; data?: { formData: Record<string, unknown> } }
  | { action: 'withdraw'; id: string; data: { reason: string } }
  | { action: 'policy'; data: { mode: BudgetControlPolicy['mode']; revision: number; reason: string; acknowledged: boolean } }
  | { action: 'assign'; id: string; data: { departmentId: string; period: string; reason: string } };
export const useBudgetLifecycleMutation = () => useMutation({
  mutationFn: (input: BudgetMutation) => {
    const path = input.action === 'create' ? '/requests' : input.action === 'policy' ? '/policy'
      : input.action === 'assign' ? `/unassigned-orders/${encodeURIComponent(input.id)}/assign`
      : `/requests/${encodeURIComponent(input.id)}${input.action === 'edit' ? '' : '/' + input.action}`;
    return customInstance<ApiEnvelope<BudgetRequestItem | BudgetControlPolicy | null>>({
      url: root + path, method: input.action === 'edit' || input.action === 'policy' ? 'PUT' : 'POST',
      data: 'data' in input ? input.data : undefined,
    });
  },
});
