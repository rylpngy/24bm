import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export interface SupplierTeamRole { id: string; name: string; permissions: string[]; system: boolean }
export interface SupplierTeamRoles {
  roles: SupplierTeamRole[];
  permissions: { code: string; label: string }[];
  assignments: { userId: string; roleIds: string[] }[];
}
export interface SupplierTeamRoleDraft { name: string; permissions: string[] }
export const supplierTeamRolesKey = ['/api/v1/supplier/team-roles'] as const;
export const listSupplierTeamRoles = (signal?: AbortSignal) => customInstance<ApiEnvelope<SupplierTeamRoles>>({
  url: supplierTeamRolesKey[0], method: 'GET', signal,
});
export const createSupplierTeamRole = (data: SupplierTeamRoleDraft) => customInstance<ApiEnvelope<SupplierTeamRole>>({
  url: supplierTeamRolesKey[0], method: 'POST', data,
});
export const updateSupplierTeamRole = (id: string, data: SupplierTeamRoleDraft) => customInstance<ApiEnvelope<SupplierTeamRole>>({
  url: `${supplierTeamRolesKey[0]}/${encodeURIComponent(id)}`, method: 'PUT', data,
});
export const assignSupplierTeamRoles = (userId: string, roleIds: string[]) => customInstance<ApiEnvelope<unknown>>({
  url: `/api/v1/supplier/users/${encodeURIComponent(userId)}/roles`, method: 'PUT', data: { roleIds },
});
