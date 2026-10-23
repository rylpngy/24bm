import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierTeamRoles } from './team-roles';

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), assign: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  supplierTeamRolesKey: ['/api/v1/supplier/team-roles'], listSupplierTeamRoles: api.list,
  createSupplierTeamRole: api.create, updateSupplierTeamRole: api.update, assignSupplierTeamRoles: api.assign,
}));
const data = { roles: [
  { id: 'owner', name: '管理员', permissions: ['supplier:*'], system: true },
  { id: 'member', name: '业务成员', permissions: [], system: true },
  { id: 'custom', name: '质检员', permissions: ['supplier:profile:read'], system: false },
], permissions: [{ code: 'supplier:profile:read', label: '查看资料' }, { code: 'supplier:profile:manage', label: '维护资料' }],
assignments: [{ userId: 'u2', roleIds: ['member', 'custom'] }] };
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue({ data }); api.create.mockResolvedValue({}); api.update.mockResolvedValue({}); api.assign.mockResolvedValue({}); });
afterEach(cleanup);
function show(props: Partial<React.ComponentProps<typeof SupplierTeamRoles>> = {}) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <SupplierTeamRoles canManage currentUserId="u1" onBack={vi.fn()} onSaved={vi.fn()} {...props} />
  </QueryClientProvider>);
}
it('does not fetch or render manager controls for non-managers', () => {
  show({ canManage: false }); expect(api.list).not.toHaveBeenCalled(); expect(screen.queryByText('角色管理')).toBeNull();
});
it('creates a role using curated permission checkboxes', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: '新增角色' }));
  expect((screen.getByLabelText('角色名称') as HTMLInputElement).maxLength).toBe(80);
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '  验收员  ' } });
  fireEvent.click(screen.getByLabelText('查看资料'));
  expect(screen.queryByLabelText('supplier:*')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith({ name: '验收员', permissions: ['supplier:profile:read'] }));
  await screen.findByText('角色已保存；受影响的本地登录成员需重新登录。');
});
it('edits custom roles but never system roles', async () => {
  show(); await screen.findByText('质检员');
  expect(screen.queryByRole('button', { name: '编辑管理员' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '编辑质检员' }));
  expect((screen.getByLabelText('查看资料') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('维护资料'));
  fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('custom', { name: '质检员', permissions: ['supplier:profile:read', 'supplier:profile:manage'] }));
});
it('loads all assigned roles and replaces the complete selection only on save', async () => {
  const onSaved = vi.fn();
  show({ member: { id: 'u2', name: '张三' }, onSaved });
  const member = await screen.findByLabelText('业务成员');
  expect((member as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('质检员') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('管理员'));
  fireEvent.click(member);
  expect(api.assign).not.toHaveBeenCalled();
  expect(screen.getByText('保存将替换该成员的全部角色授权；本地登录成员需重新登录。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '保存授权' }));
  await waitFor(() => expect(api.assign).toHaveBeenCalledWith('u2', ['custom', 'owner']));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('权限已更新；本地登录成员需重新登录。'));
});
it('prevents self assignment', async () => {
  show({ member: { id: 'u1', name: '自己' } });
  await screen.findByText('不能修改当前登录账号的角色');
  expect(screen.queryByRole('button', { name: '保存授权' })).toBeNull();
  expect(api.assign).not.toHaveBeenCalled();
});
it('requires explicit legacy removal before saving replacement roles and cannot regrant it', async () => {
  api.list.mockResolvedValue({ data: { ...data, assignments: [{ userId: 'u2', roleIds: ['role-supplier-sales', 'custom'] }] } });
  show({ member: { id: 'u2', name: '张三' } });
  const legacy = await screen.findByLabelText('历史角色：role-supplier-sales（取消后由所选角色替换）');
  expect((legacy as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('业务成员'));
  const save = screen.getByRole('button', { name: '保存授权' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(save);
  expect(api.assign).not.toHaveBeenCalled();
  fireEvent.click(legacy);
  expect((legacy as HTMLInputElement).checked).toBe(false);
  expect((legacy as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText('质检员') as HTMLInputElement).checked).toBe(true);
  expect((save as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(save);
  await waitFor(() => expect(api.assign).toHaveBeenCalledWith('u2', ['custom', 'member']));
});
it('does not offer a legacy grant for members who never had it', async () => {
  show({ member: { id: 'u2', name: '张三' } });
  await screen.findByLabelText('业务成员');
  expect(screen.queryByLabelText(/历史角色/)).toBeNull();
});
it('keeps unknown custom assignments fail-closed even after legacy removal', async () => {
  api.list.mockResolvedValue({ data: { ...data, assignments: [{ userId: 'u2', roleIds: ['role-supplier-sales', 'missing-custom', 'member'] }] } });
  show({ member: { id: 'u2', name: '张三' } });
  fireEvent.click(await screen.findByLabelText(/历史角色：role-supplier-sales/));
  expect(screen.queryByLabelText(/历史角色：missing-custom/)).toBeNull();
  expect(screen.getByText(/存在未识别的授权项/)).toBeTruthy();
  const save = screen.getByRole('button', { name: '保存授权' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(save);
  expect(api.assign).not.toHaveBeenCalled();
});
it('keeps the draft and displays save errors', async () => {
  api.create.mockRejectedValue({ response: { data: { message: '角色名称已存在' } } });
  show(); fireEvent.click(await screen.findByRole('button', { name: '新增角色' }));
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '验收员' } });
  fireEvent.click(screen.getByLabelText('查看资料'));
  fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
  await screen.findByText('角色名称已存在');
  expect((screen.getByLabelText('角色名称') as HTMLInputElement).value).toBe('验收员');
});
it('locks save, checkboxes and navigation while a request is pending', async () => {
  let complete!: (value: unknown) => void;
  api.assign.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  show({ member: { id: 'u2', name: '张三' } });
  await screen.findByLabelText('业务成员');
  fireEvent.click(screen.getByRole('button', { name: '保存授权' }));
  const save = await screen.findByRole('button', { name: '保存中' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '取消' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByLabelText('业务成员').closest('fieldset[disabled]')).toBeTruthy();
  fireEvent.click(save);
  expect(api.assign).toHaveBeenCalledTimes(1);
  complete({});
  await screen.findByRole('button', { name: '保存授权' });
});
it('shows retry and no editor after a list failure', async () => {
  api.list.mockRejectedValueOnce(new Error('offline'));
  show();
  fireEvent.click(await screen.findByRole('button', { name: '重试' }));
  await screen.findByRole('button', { name: '新增角色' });
  expect(api.list).toHaveBeenCalledTimes(2);
});
