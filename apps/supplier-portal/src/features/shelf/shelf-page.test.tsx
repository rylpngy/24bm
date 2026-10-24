import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShelfPage } from './shelf-page';

const mocks = vi.hoisted(() => ({ price: vi.fn(), status: vi.fn(), submit: vi.fn(), listings: vi.fn() }));
vi.mock('./product-center', () => ({ ProductCenter: ({ canManage, onBusyChange }: { canManage: boolean; onBusyChange: (busy: boolean) => void }) => <div data-testid="products">{String(canManage)}<button onClick={() => onBusyChange(true)}>开始商品操作</button><button onClick={() => onBusyChange(false)}>结束商品操作</button></div> }));
vi.mock('./mall-after-sales-panel', () => ({ SupplierMallAfterSalesPanel: ({ canManage }: { canManage: boolean }) => <div data-testid="after-sales">{String(canManage)}</div> }));
vi.mock('@24bid/api-client', () => ({
  useSupplierMallListings: (options: unknown) => { mocks.listings(options); return { data: { data: [{ id: 'listing', productId: 'product', materialName: '复印纸', tenantName: '采购企业', price: 10, status: '下架', productStatus: '待审核' }] } }; },
  useSupplierMallUpdatePrice: () => ({ mutateAsync: mocks.price }),
  useSupplierMallUpdateStatus: () => ({ mutateAsync: mocks.status, mutate: mocks.status }),
  useSupplierMallUpdateProductStatus: () => ({ mutate: mocks.submit }),
  useSupplierMallMaterials: () => ({ data: { data: [] } }),
  useSupplierMallPublish: () => ({}),
}));
beforeEach(() => { vi.clearAllMocks(); mocks.price.mockResolvedValue({}); mocks.status.mockResolvedValue({}); });
afterEach(cleanup);
const show = (canManage = true) => render(<QueryClientProvider client={new QueryClient()}><ShelfPage canManage={canManage} /></QueryClientProvider>);
const showLegacy = (canManage = true) => { show(canManage); fireEvent.click(screen.getByRole('tab', { name: '协议货架' })); };

it('saving a legacy price does not follow with a reactivation request', async () => {
  showLegacy(); fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  expect(screen.getByRole('button', { name: '在架' })).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12.5' } });
  fireEvent.click(screen.getByRole('button', { name: '保存商品' }));
  await waitFor(() => expect(mocks.price).toHaveBeenCalledWith({ listingId: 'listing', data: { price: 12.5 } }));
  expect(mocks.status).not.toHaveBeenCalled();
  expect(await screen.findByText('价格已保存，商品需重新提交采购方审核。')).toBeTruthy();
  expect(screen.getByRole('tab', { name: '协议货架' })).toHaveAttribute('aria-selected', 'true');
});

it('invalid legacy prices cannot silently save only the status', () => {
  showLegacy(); fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-1' } });
  expect(screen.getByRole('button', { name: '保存商品' })).toBeDisabled();
  expect(mocks.price).not.toHaveBeenCalled(); expect(mocks.status).not.toHaveBeenCalled();
});

it('read-only shelf propagates permission to both integrated panels and hides legacy writes', () => {
  show(false);
  expect(screen.getByTestId('products')).toHaveTextContent('false');
  fireEvent.click(screen.getByRole('tab', { name: '售后办理' }));
  expect(screen.getByTestId('after-sales')).toHaveTextContent('false');
  fireEvent.click(screen.getByRole('tab', { name: '协议货架' }));
  expect(screen.queryByRole('button', { name: '发布商品' })).toBeNull();
  expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
  expect(screen.queryByRole('button', { name: '编辑商品' })).toBeNull();
});

it('failed price edits retain inputs and show the actual server reason', async () => {
  mocks.price.mockRejectedValue({ response: { data: { message: '供应商准入已撤销' } } });
  showLegacy(); fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12.5' } });
  fireEvent.click(screen.getByRole('button', { name: '保存商品' }));
  expect(await screen.findByText('供应商准入已撤销')).toBeTruthy();
  expect(screen.getByRole('spinbutton')).toHaveValue(12.5);
});

it('defaults to the product center without mounting duplicate legacy or after-sales lists', () => {
  show();
  expect(screen.getByRole('tab', { name: '商品中心' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: '商品中心' })).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByTestId('after-sales')).toBeNull();
  expect(screen.queryByRole('button', { name: '发布商品' })).toBeNull();
  expect(mocks.listings).toHaveBeenLastCalledWith({ query: { enabled: false } });
});

it('mounts only the selected workspace and enables legacy loading only for the agreement shelf', () => {
  showLegacy();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.queryByTestId('products')).toBeNull();
  expect(screen.queryByTestId('after-sales')).toBeNull();
  expect(mocks.listings).toHaveBeenLastCalledWith({ query: { enabled: true } });
  fireEvent.click(screen.getByRole('tab', { name: '售后办理' }));
  expect(screen.getByTestId('after-sales')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByTestId('products')).toBeNull();
  expect(mocks.listings).toHaveBeenLastCalledWith({ query: { enabled: false } });
  fireEvent.click(screen.getByRole('tab', { name: '商品中心' }));
  expect(screen.getByTestId('products')).toBeTruthy();
  expect(screen.queryByTestId('after-sales')).toBeNull();
});

it('preserves legacy publishing, independent editing pages and the selected shelf view on return', () => {
  showLegacy();
  fireEvent.click(screen.getByRole('button', { name: '发布商品' }));
  expect(screen.getByRole('heading', { name: '发布商品' })).toBeTruthy();
  expect(screen.getByLabelText('采购方物料', { exact: false })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回商品列表' }));
  expect(screen.getByRole('tab', { name: '协议货架' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  expect(screen.getByRole('heading', { name: '编辑商品信息' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.getByRole('tabpanel', { name: '协议货架' })).toBeTruthy();
  expect(screen.queryByTestId('products')).toBeNull();
});

it('prevents switching away while a product or gallery mutation is running', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '开始商品操作' }));
  expect(screen.getByRole('tab', { name: '协议货架' })).toBeDisabled();
  expect(screen.getByRole('tab', { name: '售后办理' })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: '售后办理' }));
  expect(screen.getByTestId('products')).toBeTruthy();
  expect(screen.queryByTestId('after-sales')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '结束商品操作' }));
  fireEvent.click(screen.getByRole('tab', { name: '售后办理' }));
  expect(screen.getByTestId('after-sales')).toBeTruthy();
});
