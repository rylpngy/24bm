import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './team-page';

const mocks = vi.hoisted(() => ({ create: vi.fn(), status: vi.fn(), role: vi.fn(), profile: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useSupplierUserList: () => ({ data: { data: [
    { id: 'owner', name: '管理员', status: 'active', roleId: 'role-system-supplier-owner' },
    { id: 'member', name: '业务成员', status: 'inactive', roleId: 'role-system-supplier-member' },
  ] } }),
  useSupplierUserCreate: () => ({ mutate: mocks.create }),
  useSupplierUserChangeStatus: () => ({ mutate: mocks.status }),
  useSupplierUserResetPassword: () => ({ mutate: vi.fn() }),
  useSupplierUserChangeRole: () => ({ mutate: mocks.role }),
  useSupplierUserUpdateProfile: () => ({ mutate: mocks.profile }),
}));
afterEach(cleanup);
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => { HTMLElement.prototype.scrollIntoView = originalScroll; });
const show = (canManage = false) => render(<QueryClientProvider client={new QueryClient()}>
  <TeamPage canManage={canManage} currentUserId="owner" />
</QueryClientProvider>);

describe('supplier team authorization and status contract', () => {
  it('read-only viewers have no account mutation controls', () => {
    show();
    for (const name of ['新增成员', '重置密码', '启用', '停用', '编辑']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });
  it('prevents self-disable and sends API status values from desktop and mobile actions', () => {
    show(true);
    const disable = screen.getAllByRole('button', { name: '停用' });
    expect(disable.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    for (const button of screen.getAllByRole('button', { name: '启用' })) fireEvent.click(button);
    expect(mocks.status).toHaveBeenCalledWith({ userId: 'member', data: { status: 'active' } }, expect.any(Object));
  });
  it('creates a member with the supported active status', () => {
    show(true);
    fireEvent.click(screen.getByRole('button', { name: '新增成员' }));
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '新成员' } });
    fireEvent.change(screen.getByLabelText(/初始密码/), { target: { value: 'Test-123456!' } });
    fireEvent.change(screen.getByLabelText(/^邮箱/), { target: { value: 'member@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '创建成员' }));
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'active', name: '新成员' }) }, expect.any(Object));
  });
  it('requires confirmation before role assignment and prevents self changes', () => {
    show(true);
    expect(screen.getAllByLabelText('管理员的角色').every((el) => (el as HTMLSelectElement).disabled)).toBe(true);
    fireEvent.change(screen.getAllByLabelText('业务成员的角色')[0], { target: { value: 'role-system-supplier-owner' } });
    expect(mocks.role).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('需要重新登录');
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));
    expect(mocks.role).toHaveBeenCalledWith({ userId: 'member', data: { roleId: 'role-system-supplier-owner' } }, expect.any(Object));
  });
  it('does not expose role selectors to read-only viewers', () => {
    show();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
  it('requires a login contact before creating a member', () => {
    show(true);
    fireEvent.click(screen.getByRole('button', { name: '新增成员' }));
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '新成员' } });
    fireEvent.change(screen.getByLabelText(/初始密码/), { target: { value: 'Test-123456!' } });
    fireEvent.click(screen.getByRole('button', { name: '创建成员' }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByText('手机号或邮箱至少填写一项，用于登录')).toBeTruthy();
  });
  it('edits contact data without changing the role or password', () => {
    show(true);
    fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0]);
    expect(screen.queryByLabelText(/初始密码/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^邮箱/), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    expect(mocks.profile).toHaveBeenCalledWith({ userId: 'owner', data: { name: '管理员', email: 'owner@example.com', mobile: '' } }, expect.any(Object));
    expect(mocks.role).not.toHaveBeenCalled();
  });
});
