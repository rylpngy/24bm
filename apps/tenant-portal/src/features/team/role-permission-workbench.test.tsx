import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RolePermissionWorkbench } from './role-permission-workbench';

const state = vi.hoisted(() => ({ canManage: true, update: vi.fn(),
  role: { id: 'role-t-buyer-owner', tenantId: 't', name: 'Tenant owner', permissions: ['buyer:*'], dataScope: 'all', builtIn: true, protectedRole: true },
}));
const catalog = [{ point: 'buyer:*', label: 'All permissions', group: 'Global' },
  { point: 'buyer:role:manage', label: 'Enterprise administrator', group: 'Admin' }];
const users: never[] = [];
const catalogResponse = { data: catalog };
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => state.canManage }) }));
vi.mock('@24bid/api-client', () => ({
  useBuyerRoleList: () => ({ data: { data: [state.role] } }),
  useBuyerRolePermissionCatalog: () => ({ data: catalogResponse }),
  useBuyerUserList: () => ({ data: { data: users } }),
  useBuyerRoleCreate: () => ({ mutate: vi.fn() }),
  useBuyerRoleUpdate: () => ({ mutate: state.update }),
  useBuyerRoleDelete: () => ({ mutate: vi.fn() }),
}));
beforeEach(() => { state.canManage = true; state.update.mockReset(); });
afterEach(cleanup);
function show() { return render(<QueryClientProvider client={new QueryClient()}><RolePermissionWorkbench /></QueryClientProvider>); }
it('honors server protection for provisioned tenant owner roles', () => {
  show();
  expect((screen.getByRole('button', { name: '保存配置' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('角色名称') as HTMLInputElement).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: '删除自定义角色' })).toBeNull();
});
it('honors explicit server protection without relying on a role ID convention', () => {
  const owner = state.role;
  state.role = { ...owner, id: 'server-protected-owner' };
  try {
    show();
    expect((screen.getByLabelText('角色名称') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '删除自定义角色' })).toBeNull();
  } finally { state.role = owner; }
});
it('does not expose role configuration to an unauthorized member', () => {
  state.canManage = false;
  show();
  expect(screen.queryByRole('button', { name: '新增自定义角色' })).toBeNull();
  expect(screen.queryByRole('button', { name: '保存配置' })).toBeNull();
});
it('keeps permission and scope drafts after a failed save and explains full-admin delegation', () => {
  const owner = state.role;
  state.role = { ...owner, id: 'custom', name: 'Custom', permissions: [], dataScope: 'department', builtIn: false, protectedRole: false };
  try {
    show();
    fireEvent.click(screen.getByRole('button', { name: /Enterprise administrator/ }));
    fireEvent.click(screen.getByRole('button', { name: /仅本人/ }));
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    expect(state.update.mock.calls[0][0].data).toEqual({ name: 'Changed', permissions: ['buyer:role:manage'], dataScope: 'self' });
    act(() => state.update.mock.calls[0][1].onError({ response: { data: { message: 'Save denied' } } }));
    expect(screen.getByText('Save denied')).toBeTruthy();
    expect((screen.getByLabelText('角色名称') as HTMLInputElement).value).toBe('Changed');
    expect(screen.getByText(/可授予全部权限/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    expect(state.update.mock.calls[1][0].data.dataScope).toBe('self');
  } finally { state.role = owner; }
});
