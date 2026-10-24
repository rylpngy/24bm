import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierSourcingView } from './supplier-sourcing-view';

const api = vi.hoisted(() => ({ discover: vi.fn(), add: vi.fn(), retry: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useBuyerSupplierDiscoveryDiscover: api.discover,
  useBuyerSupplierCreate: () => ({ mutateAsync: api.add }),
}));
const candidate = { supplierId: 's1', name: '办公企业', industry: '办公', creditCode: '91370001', verifiedStatus: 'rejected', profileStatus: 'draft' };
beforeEach(() => {
  vi.resetAllMocks();
  api.discover.mockReturnValue({ data: { data: [candidate] }, refetch: api.retry });
  api.add.mockResolvedValue({});
});
afterEach(cleanup);
function show(client = new QueryClient()) {
  return render(<QueryClientProvider client={client}><SupplierSourcingView /></QueryClientProvider>);
}
it('shows API evidence without invented scores or recommendations', () => {
  show();
  expect(screen.getByRole('heading', { name: '供应商寻源' })).toBeTruthy();
  expect(screen.getByText('91370001')).toBeTruthy();
  expect(screen.getByText(/认证状态.*已驳回/)).toBeTruthy();
  expect(screen.getByText(/资料状态.*资料草稿/)).toBeTruthy();
  expect(screen.queryByText(/%|[ABC] 级|核验成本低|纳入建议|行业匹配|智能寻源/)).toBeNull();
});
it.each([undefined, { data: [candidate] }])('hides empty and stale candidates on query error', data => {
  api.discover.mockReturnValue({ isError: true, data, refetch: api.retry }); show();
  expect(screen.getByText(/检索失败/)).toBeTruthy();
  expect(screen.queryByText('办公企业')).toBeNull();
  expect(screen.queryByText(/暂无|没有匹配/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' })); expect(api.retry).toHaveBeenCalledOnce();
});
it('locks duplicate submits through refresh and invalidates discovery and supplier lists', async () => {
  let resolve!: () => void;
  api.add.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  show(client); const button = screen.getByRole('button', { name: '加入待准入' });
  fireEvent.click(button); fireEvent.click(button); expect(api.add).toHaveBeenCalledOnce();
  await act(async () => resolve());
  await waitFor(() => expect(screen.getByText(/已加入待准入/)).toBeTruthy());
  const predicate = invalidate.mock.calls[0][0]!.predicate!;
  for (const path of ['/api/v1/buyer/suppliers/discover', '/api/v1/buyer/suppliers']) {
    expect(predicate({ queryKey: [path] } as never)).toBe(true);
  }
  expect(screen.queryByRole('button', { name: '加入待准入' })).toBeNull();
});
it('reports mutation failure without inventing a cause and allows retry', async () => {
  api.add.mockRejectedValueOnce(new Error('offline')); show();
  fireEvent.click(screen.getByRole('button', { name: '加入待准入' }));
  await screen.findByText('加入失败，请重试。');
  expect(screen.queryByText(/可能已在私域/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '加入待准入' }));
  await waitFor(() => expect(api.add).toHaveBeenCalledTimes(2));
});
it('keeps missing states unknown and disables records without an ID', () => {
  api.discover.mockReturnValue({ data: { data: [{ name: '未知企业' }] } }); show();
  expect(screen.getByText(/认证状态.*未知/)).toBeTruthy();
  expect(screen.getByText(/资料状态.*未知/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '加入待准入' }) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps other candidates locked until the post-add refresh finishes', async () => {
  api.discover.mockReturnValue({ data: { data: [candidate, { ...candidate, supplierId: 's2', name: '第二企业' }] } });
  const client = new QueryClient();
  let finish!: () => void;
  vi.spyOn(client, 'invalidateQueries').mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  show(client); fireEvent.click(screen.getAllByRole('button', { name: '加入待准入' })[0]);
  await screen.findByText(/已加入待准入/);
  const remaining = screen.getByRole('button', { name: '加入待准入' }) as HTMLButtonElement;
  expect(remaining.disabled).toBe(true);
  fireEvent.click(remaining); expect(api.add).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(remaining.disabled).toBe(false);
});
it('does not report successful creation as failed when refresh fails', async () => {
  const client = new QueryClient();
  vi.spyOn(client, 'invalidateQueries').mockRejectedValue(new Error('refresh failed'));
  show(client); fireEvent.click(screen.getByRole('button', { name: '加入待准入' }));
  await screen.findByText('加入已成功，但列表刷新失败，请重试检索。');
  expect(screen.queryByRole('button', { name: '加入待准入' })).toBeNull();
  expect(screen.queryByText('加入失败，请重试。')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '检索' }));
  expect(api.retry).toHaveBeenCalledOnce();
});
