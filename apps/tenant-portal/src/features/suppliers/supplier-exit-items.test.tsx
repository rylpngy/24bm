import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierUnsettledBusiness } from './supplier-unsettled-business';

const api = vi.hoisted(() => ({ items: vi.fn(), can: vi.fn((_permission: string) => true) }));
vi.mock('@24bid/api-client', async importOriginal => ({ ...await importOriginal<object>(),
  getSupplierExitItems: api.items,
  usePurchaseOrderList: () => ({ data: { data: [] } }), useBuyerPaymentList: () => ({ data: { data: [] } }),
  useBuyerContractList: () => ({ data: { data: [] } }), useBuyerMallAfterSales: () => ({ data: { data: [] } }),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: api.can }) }));
const item = { id: 'item-1', orderId: 'order/a', invoiceId: 'invoice/a', label: '业务001', status: '待核对',
  amount: 100, invoicedAmount: 40, paidAmount: null, remainingAmount: null, reason: '付款记录待核验', handlerLabel: '财务岗位' };
beforeEach(() => {
  vi.resetAllMocks(); api.can.mockReturnValue(true);
  api.items.mockImplementation(async (_id, _kind, page) => ({ data: { items: [{ ...item, label: `业务${page}` }], total: 12, page, pageSize: 10 } }));
});
afterEach(cleanup);
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (relationId = 'rel') => <QueryClientProvider client={client}><SupplierUnsettledBusiness
    relationId={relationId} supplierId="supplier" orderCount={1} invoiceCount={1}
    uninvoicedCount={12} verificationCount={15} /></QueryClientProvider>;
  return { ...render(view()), view, client };
}
it('fetches only the selected exception kind and keeps the original four tabs', async () => {
  mount(); expect(api.items).not.toHaveBeenCalled(); expect(screen.getAllByRole('tab')).toHaveLength(6);
  fireEvent.click(screen.getByRole('tab', { name: /未足额开票/ }));
  await screen.findAllByText('业务1');
  expect(api.items).toHaveBeenCalledWith('rel', 'uninvoiced', 1, expect.any(AbortSignal));
  expect(api.items).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/可见明细.*核查数量不同/)).toBeNull();
});
it('uses server pagination, retains the current page on refresh and resets on context change', async () => {
  const result = mount(); fireEvent.click(screen.getByRole('tab', { name: /未足额开票/ }));
  await screen.findAllByText('业务1');
  fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
  await screen.findAllByText('业务2');
  expect(api.items).toHaveBeenLastCalledWith('rel', 'uninvoiced', 2, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: '刷新异常明细' }));
  await waitFor(() => expect(api.items).toHaveBeenCalledTimes(3));
  expect(api.items).toHaveBeenLastCalledWith('rel', 'uninvoiced', 2, expect.any(AbortSignal));
  result.rerender(result.view('rel-other'));
  await waitFor(() => expect(api.items).toHaveBeenLastCalledWith('rel-other', 'uninvoiced', 1, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('tab', { name: /付款待核对/ }));
  await waitFor(() => expect(api.items).toHaveBeenLastCalledWith('rel-other', 'payment-verification', 1, expect.any(AbortSignal)));
});
it.each([['未足额开票', 'buyer:order:read', '无订单查看权限'], ['付款待核对', 'buyer:invoice:read', '无发票查看权限']])('does not fetch unauthorized %s', async (tab, permission, message) => {
  api.can.mockImplementation(p => p !== permission); mount();
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(tab) }));
  expect(screen.getByText(new RegExp(message))).toBeTruthy(); expect(api.items).not.toHaveBeenCalled();
});
it('shows unknown amounts, reason and handling role with a real invoice link', async () => {
  mount(); fireEvent.click(screen.getByRole('tab', { name: /付款待核对/ }));
  await screen.findAllByText('付款记录待核验');
  expect(screen.getAllByText('财务岗位').length).toBeGreaterThan(0);
  expect(screen.getAllByText('待核对').length).toBeGreaterThan(1);
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/?module=invoices&recordId=invoice%2Fa');
  expect(screen.getAllByRole('link')[0].getAttribute('target')).toBe('_blank');
  expect(screen.getByText(/可见明细.*核查数量不同/)).toBeTruthy();
});
it('links under-invoiced rows to orders and never invents a missing target', async () => {
  api.items.mockResolvedValue({ data: { items: [{ ...item, invoiceId: null }], total: 1, page: 1, pageSize: 10 } });
  mount(); fireEvent.click(screen.getByRole('tab', { name: /未足额开票/ }));
  await screen.findAllByText('业务001');
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/?module=orders&recordId=order%2Fa');
  fireEvent.click(screen.getByRole('tab', { name: /付款待核对/ }));
  await screen.findAllByText('业务001');
  expect(screen.queryByRole('link')).toBeNull();
});
it('shows loading then error with retry, never an empty success', async () => {
  let reject!: (reason: unknown) => void;
  api.items.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  mount(); fireEvent.click(screen.getByRole('tab', { name: /未足额开票/ }));
  expect(screen.getByText(/正在读取异常明细/)).toBeTruthy();
  await waitFor(() => expect(api.items).toHaveBeenCalledTimes(1)); reject(new Error('offline'));
  await screen.findByText(/异常明细加载失败/);
  expect(screen.queryByText(/暂无可见异常明细/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '刷新异常明细' }));
  await screen.findAllByText('业务1');
});
it('reports a server permission denial explicitly', async () => {
  api.items.mockRejectedValue({ response: { status: 403 } }); mount();
  fireEvent.click(screen.getByRole('tab', { name: /付款待核对/ }));
  await screen.findByText(/无发票查看权限/);
  expect(screen.queryByText(/暂无可见异常明细/)).toBeNull();
});
it('fails closed for an incomplete page response', async () => {
  api.items.mockResolvedValue({ data: {} }); mount();
  fireEvent.click(screen.getByRole('tab', { name: /未足额开票/ }));
  await screen.findByText(/异常明细加载失败/);
  expect(screen.queryByText(/暂无可见异常明细/)).toBeNull();
});
it('hides cached rows if refresh fails and retains the requested page for retry', async () => {
  mount(); fireEvent.click(screen.getByRole('tab', { name: /未足额开票/ }));
  await screen.findAllByText('业务1');
  fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
  await screen.findAllByText('业务2');
  api.items.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: '刷新异常明细' }));
  await screen.findByText(/异常明细加载失败/);
  expect(screen.queryByText('业务2')).toBeNull();
  expect(screen.queryByText(/暂无可见异常明细/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '刷新异常明细' }));
  await screen.findAllByText('业务2');
  expect(api.items).toHaveBeenLastCalledWith('rel', 'uninvoiced', 2, expect.any(AbortSignal));
});
it('hides cached ledger data and stops requests when permission is removed', async () => {
  const result = mount(); fireEvent.click(screen.getByRole('tab', { name: /付款待核对/ }));
  await screen.findAllByText('业务1'); const calls = api.items.mock.calls.length;
  api.can.mockImplementation(permission => permission !== 'buyer:invoice:read');
  result.rerender(result.view());
  expect(screen.getByText(/无发票查看权限/)).toBeTruthy();
  expect(screen.queryByText('业务1')).toBeNull();
  expect(screen.queryByRole('button', { name: '刷新异常明细' })).toBeNull();
  expect(api.items).toHaveBeenCalledTimes(calls);
});
