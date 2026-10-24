import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PublicCatalogReviewsPage } from './public-catalog-reviews-page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api }));
vi.mock('@24bid/api-client/mall-product-media', () => ({ useMallProductImages: () => ({
  images: [], query: { data: [], isPending: false, isError: false, refetch: vi.fn() }, imageError: false,
}) }));
const root = '/api/v1/platform/mall/products';
const product = { id: 'public-product', name: '公开复印纸', supplierName: '供应商甲', scope: 'public', status: '待审核', skuCount: 1,
  skus: [{ id: 'sku', skuCode: 'A4', unit: '箱', price: 12.5, minOrderQty: 2, stepQty: 2, stockQty: 8, leadTimeDays: 3, spec: '{"size":"A4"}', status: '在架', tierPrices: [{ minQty: 10, price: 11 }] }] };
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: [product] } });
  api.post.mockImplementation(async (_url, body) => {
    api.get.mockResolvedValue({ data: { data: [] } });
    return { data: { data: { ...product, status: body.approved ? '在架' : '草稿' } } };
  });
});
afterEach(cleanup);
const show = (canManage = true) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><PublicCatalogReviewsPage canManage={canManage} /></QueryClientProvider>);
const open = async () => { show(); fireEvent.click(await screen.findByRole('button', { name: '审核商品' })); };

it('does not fetch or expose review controls without actual platform authorization', () => {
  show(false);
  expect(screen.getByText('当前账号无权审核公开商品。')).toBeTruthy();
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '审核通过' })).toBeNull();
});

it('loads the real queue and shows complete SKU terms before approval', async () => {
  await open();
  expect(api.get).toHaveBeenCalledWith(`${root}/pending-review`, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(screen.getByText(/起订 2 · 步长 2 · 库存 8 · 交期 3 天/)).toBeTruthy();
  expect(screen.getByText(/阶梯价：10 起 ¥11.00/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '审核通过' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('审核意见'), { target: { value: '  已核对规格和报价  ' } });
  fireEvent.click(screen.getByRole('button', { name: '审核通过' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${root}/public-product/review`, { approved: true, comment: '已核对规格和报价' }));
  expect(await screen.findByText('「公开复印纸」已审核通过并上架。')).toBeTruthy();
  expect(await screen.findByText('暂无待审公开商品')).toBeTruthy();
});

it('supports rejection with reasons and reports the actual draft outcome', async () => {
  await open();
  fireEvent.change(screen.getByLabelText('审核意见'), { target: { value: '请修正规格' } });
  fireEvent.click(screen.getByRole('button', { name: '驳回' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${root}/public-product/review`, { approved: false, comment: '请修正规格' }));
  expect(await screen.findByText('「公开复印纸」已退回草稿。')).toBeTruthy();
});

it('preserves comments and shows server conflict feedback when review fails', async () => {
  api.post.mockRejectedValue({ response: { data: { message: '商品已被修改，请刷新审核台' } } });
  await open();
  fireEvent.change(screen.getByLabelText('审核意见'), { target: { value: '核对意见' } });
  fireEvent.click(screen.getByRole('button', { name: '审核通过' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('商品已被修改，请刷新审核台');
  expect(screen.getByLabelText('审核意见')).toHaveValue('核对意见');
  expect(screen.queryByText(/已审核通过并上架/)).toBeNull();
});

it('blocks a second decision and navigation while submission is pending', async () => {
  let resolve!: (value: unknown) => void;
  api.post.mockImplementation(() => new Promise(r => { resolve = r; }));
  await open();
  fireEvent.change(screen.getByLabelText('审核意见'), { target: { value: '核对完成' } });
  fireEvent.click(screen.getByRole('button', { name: '审核通过' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '驳回' })).toBeDisabled());
  expect(screen.getByRole('button', { name: '返回待审清单' })).toBeDisabled();
  expect(api.post).toHaveBeenCalledTimes(1);
  resolve({ data: { data: { ...product, status: '在架' } } });
  expect(await screen.findByText('「公开复印纸」已审核通过并上架。')).toBeTruthy();
});

it('reports queue loading failure instead of showing a misleading empty result', async () => {
  api.get.mockRejectedValue(new Error('Unavailable'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('待审商品加载失败');
  expect(screen.queryByText('暂无待审公开商品')).toBeNull();
});
