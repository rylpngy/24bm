import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuyerMemberEditorDialog } from './buyer-member-editor-dialog';

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), roles: vi.fn(), canManage: true }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => api.canManage }) }));
vi.mock('@24bid/api-client', () => ({
  useBuyerUserCreate: () => ({ mutate: api.create }),
  useBuyerUserUpdate: () => ({ mutate: api.update }),
  useBuyerUserUpdateRoles: () => ({ mutateAsync: api.roles }),
}));
beforeEach(() => { vi.resetAllMocks(); api.canManage = true; });
afterEach(cleanup);
const member = { id: 'u', name: 'Member', departmentId: 'd', status: 'inactive', roleId: 'a', roleIds: ['a', 'b'] };
function show(edit = true) {
  const onSaved = vi.fn();
  render(<BuyerMemberEditorDialog open member={edit ? member : undefined}
    departments={[{ id: 'd', name: 'Dept' }]} roles={[{ id: 'a', name: 'Role A' }, { id: 'b', name: 'Role B' }]}
    onClose={vi.fn()} onSaved={onSaved} />);
  return onSaved;
}
it('updates profile and all assigned roles in one request, including inactive members', () => {
  show();
  expect((screen.getByLabelText('Role B') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  expect(api.update.mock.calls[0][0]).toEqual({ userId: 'u', data: expect.objectContaining({ roleIds: ['a', 'b'] }) });
  const response = { data: member };
  api.update.mock.calls[0][1].onSuccess(response);
  expect(api.roles).not.toHaveBeenCalled();
});
it('creates the account and every selected role with one request', () => {
  show(false);
  fireEvent.change(screen.getByLabelText(/成员姓名/), { target: { value: 'New member' } });
  fireEvent.change(screen.getByLabelText(/所属部门/), { target: { value: 'd' } });
  fireEvent.change(screen.getByLabelText(/初始密码/), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByLabelText('Role B'));
  fireEvent.click(screen.getByRole('button', { name: '创建成员' }));
  expect(api.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ status: 'active', roleIds: ['a', 'b'] }));
  api.create.mock.calls[0][1].onSuccess({ data: member });
  expect(api.roles).not.toHaveBeenCalled();
});
it('keeps the profile and role draft after a rejected atomic save', () => {
  const saved = show();
  fireEvent.change(screen.getByLabelText(/成员姓名/), { target: { value: 'Changed member' } });
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  act(() => api.update.mock.calls[0][1].onError({ response: { data: { message: 'Cannot remove last administrator' } } }));
  expect((screen.getByLabelText(/成员姓名/) as HTMLInputElement).value).toBe('Changed member');
  expect((screen.getByLabelText('Role B') as HTMLInputElement).checked).toBe(true);
  expect(saved).not.toHaveBeenCalled();
});
it('does not expose an editor without enterprise administration permission', () => {
  api.canManage = false;
  show();
  expect(screen.queryByRole('button', { name: '保存修改' })).toBeNull();
});
