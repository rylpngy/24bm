import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MallOrdersPage } from './mall-orders-page';

const state = vi.hoisted(() => ({
  permissions: ['buyer:order:read', 'buyer:mall:purchase', 'buyer:receipt:read', 'buyer:receipt:manage'],
  claims: [] as Record<string, unknown>[], status: '已收货', failed: false, loading: false,
  apply: vi.fn(), review: vi.fn(), receive: vi.fn(), get: vi.fn(), post: vi.fn(),
  receipts: [] as Record<string, unknown>[], deliveries: [] as Record<string, unknown>[],
  checkoutNote: '工作日下午送货', noteFailed: false,
  actorId: 'supplier-operator-1', actorName: '',
}));
vi.mock('../../lib/use-mall-permissions', () => ({ useMallPermissions: () => ({ can: (permission: string) => state.permissions.includes(permission) }) }));
vi.mock('@24bid/api-client', async original => ({
  ...await original<Record<string, unknown>>(),
  axiosInstance: { get: state.get, post: state.post },
  usePurchaseOrderList: () => ({ data: { data: [{ id: 'order', sourceMethod: '商城', status: state.status, lineItems: [{ id: 'line', description: '纸张', quantity: 5, unit: '箱' }] }] } }),
  useBuyerMallAfterSales: () => ({ data: { data: state.claims }, isError: state.failed, isLoading: state.loading }),
  useBuyerMallReviews: () => ({ data: { data: [] } }),
  useBuyerMallApplyAfterSales: () => ({ mutate: state.apply }),
  useBuyerMallSubmitReview: () => ({ mutate: state.review }),
  useBuyerDeliveryList: () => ({ data: { data: state.deliveries } }),
  useBuyerReceiptList: () => ({ data: { data: state.receipts } }),
  useBuyerReceiptCreate: () => ({ mutate: state.receive }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.permissions = ['buyer:order:read', 'buyer:mall:purchase', 'buyer:receipt:read', 'buyer:receipt:manage'];
  state.claims = []; state.status = '已收货'; state.failed = false; state.loading = false; state.receipts = []; state.deliveries = [];
  state.post.mockResolvedValue({ data: { data: [] } });
  state.checkoutNote = '工作日下午送货'; state.noteFailed = false;
  state.actorId = 'supplier-operator-1'; state.actorName = '';
  state.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/checkout-note')) {
      if (state.noteFailed) throw new Error('offline');
      return { data: { data: state.checkoutNote } };
    }
    return { data: { data: [{ id: 'event', actorId: state.actorId, actorName: state.actorName, actorRole: 'supplier', toStatus: '待买方确认', note: '退货签收', evidenceNo: 'RETURN-1', createdAt: '2026-10-24' }] } };
  });
});
afterEach(cleanup);
async function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MallOrdersPage /></QueryClientProvider>);
  const order = screen.queryByRole('button', { name: /order/ });
  if (order) fireEvent.click(order);
  return client;
}
const claim = (status: string, quantity = 2) => ({ id: 'claim', orderId: 'order', orderLineId: 'line', type: '退货', status, quantity, reason: '破损' });

it('submits partial quantity after earlier claims and excludes rejected or withdrawn quantities', async () => {
  state.claims = [claim('已完成'), { ...claim('已撤回', 5), id: 'withdrawn' }, { ...claim('已拒绝', 5), id: 'rejected' }];
  await show();
  const quantity = screen.getByLabelText('售后数量 纸张');
  expect(quantity).toHaveAttribute('max', '3');
  fireEvent.change(quantity, { target: { value: '1.5' } });
  fireEvent.change(screen.getByLabelText('售后原因 纸张'), { target: { value: '部分破损' } });
  fireEvent.click(screen.getByRole('button', { name: '申请售后' }));
  expect(state.apply).toHaveBeenCalledWith({ data: { orderId: 'order', orderLineId: 'line', type: '退货', quantity: 1.5, reason: '部分破损' } }, expect.anything());
});

it('blocks invalid quantities and hides requests when cumulative quantity is exhausted', async () => {
  await show();
  fireEvent.change(screen.getByLabelText('售后原因 纸张'), { target: { value: '破损' } });
  for (const value of ['0', '6', '0.001']) {
    fireEvent.change(screen.getByLabelText('售后数量 纸张'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '申请售后' }));
  }
  expect(state.apply).not.toHaveBeenCalled();
  cleanup(); state.claims = [claim('处理中', 5)]; await show();
  expect(screen.queryByRole('button', { name: '申请售后' })).toBeNull();
});

it('confirms with a note, refreshes history and preserves the financial warning', async () => {
  state.claims = [claim('待买方确认')];
  const client = await show();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  fireEvent.click(screen.getByRole('button', { name: '确认处理结果' }));
  expect(state.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('确认或撤回说明 claim'), { target: { value: '已核实签收' } });
  fireEvent.click(screen.getByRole('button', { name: '确认处理结果' }));
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/api/v1/buyer/mall/after-sales/claim/confirm', { note: '已核实签收' }));
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '办理历史' }));
  expect(await screen.findByText('凭据：RETURN-1')).toBeTruthy();
  expect(state.get).toHaveBeenCalledWith('/api/v1/buyer/mall/after-sales/claim/history', expect.anything());
});

it('withdraws only pending cases and retains notes on backend rejection', async () => {
  state.claims = [claim('待处理')];
  state.post.mockRejectedValue({ response: { data: { message: '售后状态已变更' } } });
  await show();
  fireEvent.change(screen.getByLabelText('确认或撤回说明 claim'), { target: { value: '取消申请' } });
  fireEvent.click(screen.getByRole('button', { name: '撤回申请' }));
  expect(await screen.findByText('售后状态已变更')).toBeTruthy();
  expect(screen.getByLabelText('确认或撤回说明 claim')).toHaveValue('取消申请');
  expect(state.post).toHaveBeenCalledWith('/api/v1/buyer/mall/after-sales/claim/withdraw', { note: '取消申请' });
});

it('keeps order readers read-only while allowing scoped history', async () => {
  state.permissions = ['buyer:order:read']; state.claims = [claim('待买方确认')];
  await show();
  for (const name of ['申请售后', '确认处理结果', '撤回申请', '提交评价', '登记收货']) expect(screen.queryByRole('button', { name })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '办理历史' }));
  expect(await screen.findByText('凭据：RETURN-1')).toBeTruthy();
});

it('does not offer writes from failed or loading aftersales data', async () => {
  state.failed = true; await show();
  expect(screen.queryByRole('button', { name: '申请售后' })).toBeNull();
  cleanup(); state.failed = false; state.loading = true; await show();
  expect(screen.queryByRole('button', { name: '申请售后' })).toBeNull();
});

it('shows logistics and registers only explicitly entered receipt quantities', async () => {
  state.status = '已发货';
  state.deliveries = [{ id: 'delivery', orderId: 'order', carrier: '承运方', trackingNo: 'TRACK-1', shippedQuantity: 4, lineItems: [{ orderLineId: 'line', shippedQuantity: 4 }] }];
  state.receipts = [{ id: 'receipt', orderId: 'order', receivedQuantity: 1, qualifiedQuantity: 1, lineItems: [{ orderLineId: 'line', receivedQuantity: 1, qualifiedQuantity: 1 }] }];
  await show();
  expect(screen.getByText(/TRACK-1/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('本次收货 纸张'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('本次合格 纸张'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: '登记收货' }));
  expect(state.receive).toHaveBeenCalledWith({ orderId: 'order', data: expect.objectContaining({ result: '验收合格', receivedQuantity: 2, qualifiedQuantity: 2, lineItems: [{ orderLineId: 'line', receivedQuantity: 2, qualifiedQuantity: 2 }] }) }, expect.anything());
});

it('does not fabricate receipt quantities from header-only historical deliveries', async () => {
  state.status = '已发货'; state.deliveries = [{ id: 'legacy', orderId: 'order', shippedQuantity: 5 }];
  await show();
  expect(screen.queryByRole('button', { name: '登记收货' })).toBeNull();
  expect(state.receive).not.toHaveBeenCalled();
});

it('keeps completed-order actions aligned with the existing API status contract', async () => {
  state.status = '已完成'; await show();
  expect(screen.queryByRole('button', { name: '申请售后' })).toBeNull();
  expect(screen.queryByRole('button', { name: '提交评价' })).toBeNull();
});

it('requires receipt read and manage together and never silently marks defects qualified', async () => {
  state.status = '已发货';
  state.deliveries = [{ id: 'delivery', orderId: 'order', shippedQuantity: 4, lineItems: [{ orderLineId: 'line', shippedQuantity: 4 }] }];
  state.permissions = ['buyer:order:read', 'buyer:receipt:read']; await show();
  expect(screen.queryByRole('button', { name: '登记收货' })).toBeNull();
  cleanup(); state.permissions.push('buyer:receipt:manage'); await show();
  fireEvent.change(screen.getByLabelText('本次收货 纸张'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('本次合格 纸张'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '登记收货' }));
  expect(state.receive).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('验收及处置说明'), { target: { value: '破损一箱，退换' } });
  fireEvent.click(screen.getByRole('button', { name: '登记收货' }));
  expect(state.receive).toHaveBeenCalledWith({ orderId: 'order', data: expect.objectContaining({ result: '部分合格', receivedQuantity: 2, qualifiedQuantity: 1, disposition: '退货换货', dispositionNote: '破损一箱，退换' }) }, expect.anything());
});

it('shows completed returns as financial reconciliation pending, not refunded', async () => {
  state.claims = [claim('已完成')]; await show();
  expect(screen.getByText(/退货财务待核对，非银行退款凭证/)).toBeTruthy();
});

it('loads checkout note only for the expanded order using the new endpoint', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MallOrdersPage /></QueryClientProvider>);
  expect(state.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /order/ }));
  expect(await screen.findByText('工作日下午送货')).toBeTruthy();
  expect(state.get).toHaveBeenCalledWith('/api/v1/buyer/mall/orders/order/checkout-note', expect.objectContaining({ signal: expect.anything() }));
});

it('distinguishes an empty checkout note from a failed load', async () => {
  state.checkoutNote = ''; await show();
  expect(await screen.findByText('未填写结算备注')).toBeTruthy();
  cleanup(); state.noteFailed = true; await show();
  expect(await screen.findByText('结算备注加载失败')).toBeTruthy();
  expect(screen.queryByText('未填写结算备注')).toBeNull();
});

it.each([
  { actorId: 'supplier-operator-1', actorName: '', expected: '办理人：ID: supplier-operator-1' },
  { actorId: 'buyer-1', actorName: '张三', expected: '办理人：张三' },
  { actorId: '', actorName: '  ', expected: '办理人：未记录办理人' },
])('identifies the history actor: $expected', async ({ actorId, actorName, expected }) => {
  state.actorId = actorId; state.actorName = actorName; state.claims = [claim('待买方确认')];
  await show();
  fireEvent.click(screen.getByRole('button', { name: '办理历史' }));
  expect(await screen.findByText(expected)).toBeTruthy();
});
