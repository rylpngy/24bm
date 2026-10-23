import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

const access = vi.hoisted(() => ({ permissions: [] as string[], cartEnabled: false, failed: false }));
vi.mock('./lib/use-mall-permissions', () => ({ useMallPermissions: () => ({
  can: (permission: string) => !access.failed && access.permissions.includes(permission),
  query: { isError: access.failed },
}) }));
vi.mock('./lib/auth-store', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({
  session: { userId: 'reader', displayName: '只读用户' }, signOut: () => {},
}) }));
vi.mock('@24bid/api-client', async (original) => ({
  ...await original<Record<string, unknown>>(),
  useBuyerMallCart: (options: { query: { enabled: boolean } }) => {
    access.cartEnabled = options.query.enabled;
    return {};
  },
}));
vi.mock('./features/orders/mall-orders-page', () => ({ MallOrdersPage: () => <p>订单页面</p> }));
afterEach(() => { cleanup(); access.permissions = []; access.failed = false; window.history.replaceState(null, '', '/'); });

it('blocks direct checkout navigation for catalog-only users', () => {
  access.permissions = ['buyer:mall:read'];
  window.history.replaceState(null, '', '/?view=checkout');
  render(<App />);
  expect(screen.getByText(/当前账号无权访问/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '我的订单' })).toBeNull();
});

it('allows order readers without implicitly requesting a cart', () => {
  access.permissions = ['buyer:order:read'];
  window.history.replaceState(null, '', '/?view=orders');
  render(<App />);
  expect(screen.getByText('订单页面')).toBeTruthy();
  expect(access.cartEnabled).toBe(false);
  expect(screen.queryByRole('button', { name: '购物车' })).toBeNull();
});

it('fails closed when permissions cannot be refreshed', () => {
  access.permissions = ['buyer:order:read'];
  access.failed = true;
  window.history.replaceState(null, '', '/?view=orders');
  render(<App />);
  expect(screen.getByText(/权限加载失败/)).toBeTruthy();
  expect(screen.queryByText('订单页面')).toBeNull();
  expect(access.cartEnabled).toBe(false);
});
