import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './team-page';

const mocks = vi.hoisted(() => ({ create: vi.fn(), status: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useSupplierUserList: () => ({ data: { data: [
    { id: 'owner', name: '管理员', status: 'active' },
    { id: 'member', name: '业务成员', status: 'inactive' },
  ] } }),
  useSupplierUserCreate: () => ({ mutate: mocks.create }),
  useSupplierUserChangeStatus: () => ({ mutate: mocks.status }),
  useSupplierUserResetPassword: () => ({ mutate: vi.fn() }),
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const show = (canManage = false) => render(<QueryClientProvider client={new QueryClient()}>
  <TeamPage canManage={canManage} currentUserId="owner" />
</QueryClientProvider>);

describe('supplier team authorization and status contract', () => {
  it('read-only viewers have no account mutation controls', () => {
    show();
    for (const name of ['新增成员', '重置密码', '启用', '停用']) {
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
    fireEvent.click(screen.getByRole('button', { name: '创建成员' }));
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'active', name: '新成员' }) }, expect.any(Object));
  });
});
