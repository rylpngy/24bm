import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MallPage } from './mall-page';

const api = vi.hoisted(() => ({ direct: vi.fn(), checkout: vi.fn(), quantity: 2, address: 'address-1' }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (permission: string) => ['buyer:mall:read', 'buyer:mall:purchase'].includes(permission) }) }));
vi.mock('./mall-purchase-controls', () => ({ MallPurchaseControls: () => null }));
vi.mock('./mall-after-sales-panel', () => ({ BuyerMallAfterSalesPanel: () => null }));
vi.mock('@24bid/api-client', async original => {
  const actual = await original<Record<string, unknown>>();
  const mocks: Record<string, unknown> = {};
  for (const name of ['useBuyerMallCheckoutCart', 'useBuyerMallAddToCart', 'useBuyerMallUpdateCartItem',
    'useBuyerMallRemoveCartItem', 'useBuyerMallReviewProduct', 'useBuyerMallPublish', 'useBuyerMallUpdateStatus']) mocks[name] = () => ({});
  for (const name of ['useBuyerMallProducts', 'useBuyerMallPendingReview', 'useBuyerSupplierList', 'useMaterialList']) mocks[name] = () => ({ data: { data: [] } });
  return { ...actual, ...mocks,
    useBuyerMallCreateOrder: () => ({ mutate: api.direct, isPending: false }),
    useBuyerMallCheckoutServerCart: () => ({ mutate: api.checkout, isPending: false }),
    useBuyerMallListings: () => ({ data: { data: [{ id: 'sku', materialName: '纸张', status: '在架', price: 10 }] } }),
    useBuyerMallAddresses: () => ({ data: { data: [{ id: api.address, receiver: '收货人' }] } }),
    useBuyerMallCart: () => ({ data: { data: { groups: [{ lines: [{ skuId: 'sku', productName: '纸张', quantity: api.quantity }] }] } } }),
  };
});
beforeEach(() => { vi.clearAllMocks(); api.quantity = 2; api.address = 'address-1'; });
afterEach(cleanup);
function show() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><MallPage /></QueryClientProvider>);
}
function fail(mock: typeof api.direct, index = 0) {
  act(() => mock.mock.calls[index][1].onError({ response: { data: { message: '请求失败，请重试' } } }));
}
function succeed(mock: typeof api.direct, data: unknown, index: number) {
  act(() => mock.mock.calls[index][1].onSuccess({ data }));
}
const key = (mock: typeof api.direct, index: number) => mock.mock.calls[index][0].data.idempotencyKey;

it('guards rapid direct clicks, keeps the key on retry and rotates it after success', () => {
  show();
  const button = screen.getByRole('button', { name: /直购下单/ });
  act(() => { button.click(); button.click(); });
  expect(api.direct).toHaveBeenCalledTimes(1);
  expect(key(api.direct, 0)).toEqual(expect.any(String));
  expect(key(api.direct, 0).length).toBeGreaterThan(0);
  fail(api.direct);
  fireEvent.click(button);
  expect(key(api.direct, 1)).toBe(key(api.direct, 0));
  succeed(api.direct, { orderId: 'order' }, 1);
  fireEvent.click(button);
  expect(key(api.direct, 2)).not.toBe(key(api.direct, 1));
});

it('uses a different direct intent key when quantity changes and preserves earlier failed intent keys', () => {
  show();
  const button = screen.getByRole('button', { name: /直购下单/ });
  fireEvent.click(button); fail(api.direct);
  fireEvent.change(screen.getByLabelText('数量 纸张'), { target: { value: '3' } });
  fireEvent.click(button); fail(api.direct, 1);
  expect(key(api.direct, 1)).not.toBe(key(api.direct, 0));
  expect(api.direct.mock.calls[1][0].data.quantity).toBe(3);
  fireEvent.change(screen.getByLabelText('数量 纸张'), { target: { value: '1' } });
  fireEvent.click(button);
  expect(key(api.direct, 2)).toBe(key(api.direct, 0));
});

it('guards cart checkout clicks and reuses its key only until successful checkout', () => {
  show();
  const button = screen.getByRole('button', { name: '结算下单' });
  act(() => { button.click(); button.click(); });
  expect(api.checkout).toHaveBeenCalledTimes(1);
  expect(api.checkout.mock.calls[0][0].data).toEqual({ addressId: 'address-1', idempotencyKey: expect.any(String) });
  fail(api.checkout); fireEvent.click(button);
  expect(key(api.checkout, 1)).toBe(key(api.checkout, 0));
  succeed(api.checkout, [], 1); fireEvent.click(button);
  expect(key(api.checkout, 2)).not.toBe(key(api.checkout, 1));
});

it('fingerprints cart contents and address, and shares a synchronous submit guard with direct orders', () => {
  const view = show();
  fireEvent.click(screen.getByRole('button', { name: /直购下单/ }));
  fireEvent.click(screen.getByRole('button', { name: '结算下单' }));
  expect(api.checkout).not.toHaveBeenCalled();
  fail(api.direct);
  fireEvent.click(screen.getByRole('button', { name: '结算下单' })); fail(api.checkout);
  api.quantity = 3;
  view.rerender(<QueryClientProvider client={new QueryClient()}><MallPage /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: '结算下单' })); fail(api.checkout, 1);
  expect(key(api.checkout, 1)).not.toBe(key(api.checkout, 0));
  api.address = 'address-2';
  view.rerender(<QueryClientProvider client={new QueryClient()}><MallPage /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: '结算下单' }));
  expect(key(api.checkout, 2)).not.toBe(key(api.checkout, 1));
  expect(api.checkout.mock.calls[2][0].data.addressId).toBe('address-2');
});
