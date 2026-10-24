import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierInvitationsView } from './supplier-invitations-view';
const api = vi.hoisted(() => ({ list: vi.fn(), discover: vi.fn(), create: vi.fn(), respond: vi.fn(), can: true }));
vi.mock('@24bid/api-client', () => ({ useBuyerSupplierInvitationList: api.list,
  useBuyerSupplierDiscoveryDiscover: api.discover,
  useBuyerSupplierInvitationCreate: () => ({ mutate: api.create }), useBuyerSupplierInvitationRespond: () => ({ mutate: api.respond }) }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => api.can }) }));
vi.mock('../shared/excel-import-control', () => ({ ExcelImportControl: () => null }));
beforeEach(() => {
  vi.resetAllMocks(); api.can = true;
  api.list.mockReturnValue({ data: { data: [
    { id: 'bound', supplierId: 's1', supplierName: '平台企业', linkedToKnownSupplier: true, status: '待回复' },
    { id: 'offline', supplierName: '线下企业', linkedToKnownSupplier: false, status: '待回复' },
  ] }, refetch: vi.fn() });
  api.discover.mockReturnValue({ data: { data: [{ supplierId: 's1', name: '真实平台企业' }] }, refetch: vi.fn() });
});
afterEach(cleanup);
function show() { return render(<QueryClientProvider client={new QueryClient()}><SupplierInvitationsView /></QueryClientProvider>); }
it('does not fetch or render controls without supplier manage', () => {
  api.can = false; show(); expect(api.list).not.toHaveBeenCalled(); expect(api.discover).not.toHaveBeenCalled();
});
it('allows only withdrawal for bound invitations and explicitly labels offline feedback', () => {
  show();
  const bound = screen.getByText('平台企业').closest('[data-invitation-id]')!;
  expect(within(bound as HTMLElement).getAllByRole('button').map(b => b.textContent)).toEqual(['撤回']);
  expect(screen.getByText('线下记录（未通知供应商）')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '登记线下接受' }));
  expect(api.respond).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '确认登记' }));
  expect(api.respond).toHaveBeenCalledWith({ id: 'offline', data: { action: 'accept' } }, expect.any(Object));
});
it('uses a platform selector and the selected enterprise name instead of a typed ID', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '发起邀请' }));
  expect(screen.queryByPlaceholderText(/ent-supplier/)).toBeNull();
  fireEvent.change(screen.getByLabelText('平台供应商'), { target: { value: 's1' } });
  expect((screen.getByLabelText('供应商名称') as HTMLInputElement).value).toBe('真实平台企业');
  fireEvent.click(screen.getAllByRole('button', { name: '发起邀请' }).at(-1)!);
  await waitFor(() => expect(api.create).toHaveBeenCalledWith({ data: expect.objectContaining({ supplierId: 's1', supplierName: '真实平台企业' }) }, expect.any(Object)));
});
it('shows list errors rather than empty success or stale records', () => {
  api.list.mockReturnValue({ isError: true, data: { data: [{ id: 'stale', supplierName: '过期数据' }] }, refetch: vi.fn() });
  show(); expect(screen.getByText(/邀请加载失败/)).toBeTruthy(); expect(screen.queryByText('过期数据')).toBeNull();
  expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
});
it('never carries private offline notes into a platform invitation', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '发起邀请' }));
  fireEvent.change(screen.getByLabelText('线下备注（仅买方可见）'), { target: { value: '内部备注' } });
  await act(async () => { fireEvent.change(screen.getByLabelText('平台供应商'), { target: { value: 's1' } }); });
  expect((screen.getByLabelText('邀请说明（向受邀供应商展示）') as HTMLInputElement).value).toBe('');
});
