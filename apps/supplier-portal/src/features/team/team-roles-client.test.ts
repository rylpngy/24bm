import { beforeEach, expect, it, vi } from 'vitest';
import { customInstance } from '../../../../../packages/api-client/src/http-client';
import { assignSupplierTeamRoles, createSupplierTeamRole, listSupplierTeamRoles, updateSupplierTeamRole } from '../../../../../packages/api-client/src/supplier-team-roles';

vi.mock('../../../../../packages/api-client/src/http-client', () => ({ customInstance: vi.fn().mockResolvedValue({ data: {} }) }));
beforeEach(() => vi.clearAllMocks());
it('fetches the manager role catalogue with cancellation', async () => {
  const signal = new AbortController().signal;
  await listSupplierTeamRoles(signal);
  expect(customInstance).toHaveBeenCalledWith({ url: '/api/v1/supplier/team-roles', method: 'GET', signal });
});
it('creates and updates role names and permission arrays', async () => {
  const draft = { name: '质检员', permissions: ['supplier:profile:read'] };
  await createSupplierTeamRole(draft);
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/supplier/team-roles', method: 'POST', data: draft });
  await updateSupplierTeamRole('role/a', draft);
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/supplier/team-roles/role%2Fa', method: 'PUT', data: draft });
});
it('replaces all assigned roles on the plural roles endpoint', async () => {
  await assignSupplierTeamRoles('user/a', ['owner', 'custom']);
  expect(customInstance).toHaveBeenCalledWith({ url: '/api/v1/supplier/users/user%2Fa/roles', method: 'PUT', data: { roleIds: ['owner', 'custom'] } });
});
