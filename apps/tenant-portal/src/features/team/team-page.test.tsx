import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TeamPage } from './team-page';

const api = vi.hoisted(() => ({ status: vi.fn(), canManage: true }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => api.canManage }) }));
vi.mock('@24bid/api-client', () => ({
  useBuyerUserList: () => ({ data: { data: [
    { id: 'a', name: 'Active member', status: 'active' },
    { id: 'i', name: 'Inactive member', status: 'inactive' },
  ] } }),
  useDepartmentList: () => ({ data: { data: [] } }),
  useBuyerRoleList: () => ({ data: { data: [] } }),
  useBuyerUserChangeStatus: () => ({ mutate: api.status }),
  useBuyerUserResetPassword: () => ({}),
}));
vi.mock('../shared/buyer-member-editor-dialog', () => ({ BuyerMemberEditorDialog: () => null }));
vi.mock('./role-permission-workbench', () => ({ RolePermissionWorkbench: () => null }));
vi.mock('./notification-channel-panel', () => ({ NotificationChannelPanel: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); api.canManage = true; });
function show() { render(<QueryClientProvider client={new QueryClient()}><TeamPage /></QueryClientProvider>); }
it('submits the API inactive status when disabling a member', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '停用' }));
  fireEvent.click(screen.getByRole('button', { name: '确认停用' }));
  expect(api.status).toHaveBeenCalledWith({ userId: 'a', data: { status: 'inactive' } }, expect.anything());
});
it('filters stopped members with the API inactive status', () => {
  show();
  const option = screen.getByRole('option', { name: '已停用' });
  expect((option as HTMLOptionElement).value).toBe('inactive');
  fireEvent.change(option.closest('select')!, { target: { value: 'inactive' } });
  expect(screen.queryByText('Active member')).toBeNull();
  expect(screen.getByText('Inactive member')).toBeTruthy();
});
it('does not expose member mutation controls without enterprise administration permission', () => {
  api.canManage = false;
  show();
  expect(screen.queryByRole('button', { name: '新增成员' })).toBeNull();
  expect(screen.queryByRole('button', { name: '停用' })).toBeNull();
});
