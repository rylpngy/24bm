import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { MallPage } from './mall-page';

const state = vi.hoisted(() => ({ permissions: ['buyer:mall:read'], failed: false, queries: {} as Record<string, boolean> }));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({ can: (permission: string) => state.permissions.includes(permission) }),
}));
vi.mock('@24bid/api-client', async (original) => {
  const api = await original<Record<string, unknown>>();
  const mocks: Record<string, unknown> = {};
  for (const name of ['useBuyerMallCheckoutCart', 'useBuyerMallCreateOrder', 'useBuyerMallAddToCart',
    'useBuyerMallUpdateCartItem', 'useBuyerMallRemoveCartItem', 'useBuyerMallCheckoutServerCart',
    'useBuyerMallReviewProduct', 'useBuyerMallPublish', 'useBuyerMallUpdateStatus']) mocks[name] = () => ({});
  for (const name of ['useBuyerMallProducts', 'useBuyerMallCart', 'useBuyerMallAddresses',
    'useBuyerMallPendingReview', 'useBuyerMallAfterSales', 'useBuyerSupplierList', 'useMaterialList']) {
    mocks[name] = (...args: { query?: { enabled?: boolean } }[]) => {
      state.queries[name] = args.at(-1)?.query?.enabled ?? true;
      return { data: { data: [] } };
    };
  }
  return { ...api, ...mocks, useBuyerMallListings: () => ({ isError: state.failed, data: { data: [
    { id: 'sku-1', materialName: '只读商品', supplierName: '供应商', status: '在架', price: 100 },
  ] } }) };
});
afterEach(() => { cleanup(); state.permissions = ['buyer:mall:read']; state.failed = false; state.queries = {}; });
const show = () => render(<QueryClientProvider client={new QueryClient()}><MallPage /></QueryClientProvider>);

it('renders catalog without purchasing or management actions and avoids privileged queries', () => {
  show();
  expect(screen.getByText('只读商品')).toBeTruthy();
  for (const text of ['货架维护', '上架审核', '售后处理', '直购下单', '加入购物车', '下架']) {
    expect(screen.queryByText(text)).toBeNull();
  }
  for (const name of ['useBuyerMallCart', 'useBuyerMallPendingReview', 'useBuyerMallAfterSales', 'useBuyerSupplierList', 'useMaterialList']) {
    expect(state.queries[name]).toBe(false);
  }
});

it('loads management queries only when the relevant tab is selected', () => {
  state.permissions.push('buyer:mall:manage', 'buyer:mall:purchase');
  show();
  expect(screen.getByText('直购下单')).toBeTruthy();
  expect(state.queries.useBuyerMallPendingReview).toBe(false);
  fireEvent.click(screen.getByText('上架审核'));
  expect(state.queries.useBuyerMallPendingReview).toBe(true);
});

it('does not display stale listings after a failed refresh', () => {
  state.failed = true;
  show();
  expect(screen.queryByText('只读商品')).toBeNull();
  expect(screen.getByText(/加载失败/)).toBeTruthy();
});
