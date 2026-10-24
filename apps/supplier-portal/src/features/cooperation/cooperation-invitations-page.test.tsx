import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CooperationInvitationsPage } from './cooperation-invitations-page';
const api = vi.hoisted(() => ({ list: vi.fn(), respond: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ supplierCooperationInvitationsKey: ['/api/v1/supplier/cooperation-invitations'],
  listSupplierCooperationInvitations: api.list, respondSupplierCooperationInvitation: api.respond }));
const pending = { id: 'invite', buyerName: '采购甲', supplierName: '供应乙', status: '待回复', note: '请提供合作资料', createdAt: '2026-10-24' };
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue({ data: [pending] }); api.respond.mockResolvedValue({ data: {} }); });
afterEach(cleanup);
function show(canRead = true, canManage = true) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <CooperationInvitationsPage canRead={canRead} canManage={canManage} /></QueryClientProvider>);
}
it('does not fetch without profile read permission', () => { show(false); expect(api.list).not.toHaveBeenCalled(); });
it('readers see the buyer and note but cannot respond', async () => {
  show(true, false); await screen.findByText('采购甲'); expect(screen.getByText('请提供合作资料')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '接受邀请' })).toBeNull(); expect(screen.queryByRole('button', { name: '拒绝邀请' })).toBeNull();
});
it.each([['接受邀请', '确认接受', 'accept'], ['拒绝邀请', '确认拒绝', 'decline']])('confirms %s and sends only the action', async (button, confirm, action) => {
  show(); fireEvent.click(await screen.findByRole('button', { name: button }));
  expect(api.respond).not.toHaveBeenCalled();
  if (action === 'accept') expect(screen.getByRole('dialog').textContent).toContain('待准入');
  fireEvent.click(screen.getByRole('button', { name: confirm }));
  await waitFor(() => expect(api.respond).toHaveBeenCalledWith('invite', action));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});
it('locks confirmation while pending and retains a failed action for retry', async () => {
  let reject!: (error: unknown) => void; api.respond.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  show(); fireEvent.click(await screen.findByRole('button', { name: '接受邀请' }));
  fireEvent.click(screen.getByRole('button', { name: '确认接受' }));
  const busy = await screen.findByRole('button', { name: '处理中…' }); expect((busy as HTMLButtonElement).disabled).toBe(true);
  reject({ response: { data: { message: '邀请已撤回' } } });
  await screen.findAllByText(/邀请已撤回/); expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确认接受' }));
  await waitFor(() => expect(api.respond).toHaveBeenCalledTimes(2));
});
it('does not show an empty success on load failure and retries', async () => {
  api.list.mockRejectedValueOnce(new Error('offline')); show();
  await screen.findByText(/邀请加载失败/); expect(screen.queryByText(/暂无合作邀请/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' })); await screen.findByText('采购甲');
});
it('paginates, filters buyers and keeps processed invitations read-only', async () => {
  api.list.mockResolvedValue({ data: [...Array.from({ length: 9 }, (_, index) => ({ ...pending, id: `i${index}`, buyerName: `采购${index}` })),
    { ...pending, id: 'done', buyerName: '历史采购', status: '已接受' }] });
  show(); await screen.findByText('采购0'); expect(screen.queryByText('采购8')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /下一页/ })); expect(screen.getByText('采购8')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('搜索采购企业'), { target: { value: '采购0' } }); expect(screen.getByText('采购0')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('搜索采购企业'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('tab', { name: /^已接受/ })); expect(screen.getByText('历史采购')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '接受邀请' })).toBeNull();
});
