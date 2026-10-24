import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductCenter } from './product-center';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('./supplier-product-gallery', () => ({ SupplierProductGallery: () => null }));
vi.mock('@24bid/api-client', () => ({
  axiosInstance: mocks,
  useSupplierMallMaterials: () => ({ data: { data: [
    { tenantId: 'buyer', tenantName: '采购企业', materialId: 'material', name: '纸', code: 'A4' },
    { tenantId: 'buyer2', tenantName: '另一采购企业', materialId: 'material2', name: '笔', code: 'PEN' },
  ] } }),
}));
const sku = { id: 'sku', skuCode: 'A4', spec: '{}', materialId: 'material', unit: '箱', price: 10, minOrderQty: 1, stepQty: 1, stockQty: 20, leadTimeDays: 3, status: '在架', tierPrices: [{ minQty: 10, price: 9 }] };
let product: Record<string, unknown>;
const base = '/api/v1/supplier/mall/products';
const categoryUrl = '/api/v1/supplier/mall/categories';
beforeEach(() => {
  vi.clearAllMocks();
  product = { id: 'product', tenantId: 'buyer', scope: 'tenant', name: '复印纸', brand: '品牌', status: '在架', categoryId: 'category', mainImageKey: 'image-key', skus: [sku], skuCount: 1 };
  mocks.get.mockImplementation(async (url, options) => url === categoryUrl
    ? { data: { data: [{ id: 'global', name: '通用分类' }, ...(options.params?.tenantId ? [{ id: options.params.tenantId === 'buyer2' ? 'category2' : 'category', name: options.params.tenantId === 'buyer2' ? '设备耗材' : '办公用品' }] : [])] } }
    : { data: { data: [product] } });
  mocks.put.mockResolvedValue({ data: { data: { ...product, status: '草稿' } } });
  mocks.post.mockResolvedValue({ data: { data: { id: 'created', name: '新商品', status: '草稿', skus: [] } } });
});
afterEach(cleanup);
const show = (canManage = true) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ProductCenter canManage={canManage} /></QueryClientProvider>);
const open = async () => { show(); fireEvent.click(await screen.findByRole('button', { name: '维护规格' })); };

it('preserves protected metadata and saves product edits without auto-approval', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: '编辑商品' }));
  await screen.findByRole('option', { name: '办公用品' });
  fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '新名称' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(`${base}/product`, expect.objectContaining({ name: '新名称', categoryId: 'category', mainImageKey: 'image-key' })));
  expect(mocks.put).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('商品已保存为草稿，需重新提交审核。')).toBeTruthy();
});

it('edits a real SKU with quantity, stock and tier prices through its product URL', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑规格' }));
  fireEvent.change(screen.getByLabelText('协议单价（元）'), { target: { value: '12.5' } });
  fireEvent.click(screen.getByRole('button', { name: '保存规格' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(`${base}/product/skus/sku`, expect.objectContaining({ price: 12.5, materialId: 'material', stockQty: 20, tierPrices: [{ minQty: 10, price: 9 }] })));
  expect(await screen.findByText('规格已保存，商品需重新提交审核。')).toBeTruthy();
});

it('rejects array-shaped variant input without losing the draft or sending an update', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑规格' }));
  fireEvent.change(screen.getByLabelText('规格键值 JSON'), { target: { value: '[]' } });
  fireEvent.click(screen.getByRole('button', { name: '保存规格' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('规格必须是有效的 JSON 对象');
  expect(screen.getByLabelText('规格键值 JSON')).toHaveValue('[]');
  expect(mocks.put).not.toHaveBeenCalled();
});

it('retains failed SKU changes and surfaces the actual admission error', async () => {
  mocks.put.mockRejectedValue({ response: { data: { message: '供应商准入已撤销' } } });
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑规格' }));
  fireEvent.change(screen.getByLabelText('规格编码'), { target: { value: '保留草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '保存规格' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('供应商准入已撤销');
  expect(screen.getByLabelText('规格编码')).toHaveValue('保留草稿');
});

it('only submits drafts for review, and cannot submit while no active SKU exists', async () => {
  product.status = '草稿'; product.skus = [{ ...sku, status: '下架' }];
  await open();
  expect(screen.getByRole('button', { name: '提交审核' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '启用规格' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(`${base}/product/skus/sku/status`, { status: '在架' }));
  expect(await screen.findByText('规格已启用，商品需重新提交审核。')).toBeTruthy();
});

it('creates only a draft in the selected admitted buyer scope', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '新建商品' }));
  fireEvent.change(screen.getByLabelText('目标采购方'), { target: { value: 'buyer' } });
  fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '新商品' } });
  await screen.findByRole('option', { name: '办公用品' });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(base, expect.objectContaining({ tenantId: 'buyer', name: '新商品' })));
  expect(mocks.put).not.toHaveBeenCalled();
});

it('disables navigation and repeated saves while a SKU mutation is pending', async () => {
  let resolve!: (value: unknown) => void;
  mocks.put.mockImplementation(() => new Promise(r => { resolve = r; }));
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑规格' }));
  fireEvent.click(screen.getByRole('button', { name: '保存规格' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '返回商品中心' })).toBeDisabled());
  expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
  resolve({ data: { data: product } });
  expect(await screen.findByText('规格已保存，商品需重新提交审核。')).toBeTruthy();
});

it('read-only users can inspect specifications but have no mutation controls', async () => {
  show(false);
  expect(screen.queryByRole('button', { name: '新建商品' })).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: '查看规格' }));
  expect(screen.queryByRole('button', { name: '编辑商品' })).toBeNull();
  expect(screen.queryByRole('button', { name: '编辑规格' })).toBeNull();
  expect(screen.queryByRole('button', { name: '停用规格' })).toBeNull();
  expect(mocks.put).not.toHaveBeenCalled();
});

it('public product submission targets review and reports platform review instead of publication', async () => {
  product.scope = 'public'; product.status = '草稿';
  await open();
  fireEvent.click(screen.getByRole('button', { name: '提交审核' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(`${base}/product/status`, { status: '待审核' }));
  expect(await screen.findByText('已提交平台审核。')).toBeTruthy();
  expect(mocks.put).toHaveBeenCalledTimes(1);
});

it('saves a category actually selected from the admitted buyer category dropdown on creation', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '新建商品' }));
  expect(screen.getByLabelText('商品分类')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('目标采购方'), { target: { value: 'buyer' } });
  await screen.findByRole('option', { name: '办公用品' });
  expect(mocks.get).toHaveBeenCalledWith(categoryUrl, expect.objectContaining({ params: { tenantId: 'buyer' } }));
  fireEvent.change(screen.getByLabelText('商品分类'), { target: { value: 'category' } });
  fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '有分类的新商品' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(base, expect.objectContaining({ tenantId: 'buyer', categoryId: 'category', name: '有分类的新商品' })));
});

it('loads edit categories using the immutable product destination and persists a changed category', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑商品' }));
  await screen.findByRole('option', { name: '办公用品' });
  expect(screen.getByLabelText('商品分类')).toHaveValue('category');
  expect(screen.queryByLabelText('目标采购方')).toBeNull();
  expect(mocks.get).toHaveBeenCalledWith(categoryUrl, expect.objectContaining({ params: { tenantId: 'buyer' } }));
  fireEvent.change(screen.getByLabelText('商品分类'), { target: { value: 'global' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(`${base}/product`, expect.objectContaining({ categoryId: 'global' })));
});

it('clears the old category and category options when changing destination buyer', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '新建商品' }));
  fireEvent.change(screen.getByLabelText('目标采购方'), { target: { value: 'buyer' } });
  await screen.findByRole('option', { name: '办公用品' });
  fireEvent.change(screen.getByLabelText('商品分类'), { target: { value: 'category' } });
  fireEvent.change(screen.getByLabelText('目标采购方'), { target: { value: 'buyer2' } });
  expect(screen.getByLabelText('商品分类')).toHaveValue('');
  await screen.findByRole('option', { name: '设备耗材' });
  expect(screen.queryByRole('option', { name: '办公用品' })).toBeNull();
  fireEvent.change(screen.getByLabelText('商品分类'), { target: { value: 'category2' } });
  fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '另一租户商品' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(base, expect.objectContaining({ tenantId: 'buyer2', categoryId: 'category2' })));
});

it('preserves an existing category by default even when absent from the refreshed options', async () => {
  product.categoryId = 'historical-category'; product.categoryName = '原存量分类';
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑商品' }));
  await screen.findByRole('option', { name: '办公用品' });
  expect(screen.getByLabelText('商品分类')).toHaveValue('historical-category');
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(`${base}/product`, expect.objectContaining({ categoryId: 'historical-category' })));
});

it('loads only global categories for a public product without fabricating a buyer destination', async () => {
  product.tenantId = null; product.scope = 'public'; product.categoryId = 'global';
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑商品' }));
  await screen.findByRole('option', { name: '通用分类' });
  expect(mocks.get).toHaveBeenCalledWith(categoryUrl, expect.objectContaining({ params: undefined }));
  expect(screen.queryByRole('option', { name: '办公用品' })).toBeNull();
  expect(screen.getByLabelText('商品分类')).toHaveValue('global');
});

it('does not silently save unclassified when category loading is rejected', async () => {
  mocks.get.mockImplementation(async url => {
    if (url === categoryUrl) throw new Error('Admission revoked');
    return { data: { data: [product] } };
  });
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑商品' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('商品分类加载失败');
  expect(screen.getByLabelText('商品分类')).toHaveValue('category');
  expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled();
  expect(mocks.put).not.toHaveBeenCalled();
});

it('limits SKU material choices to the immutable destination of the edited product', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑规格' }));
  const select = screen.getByLabelText('关联物料');
  expect(select).toHaveValue('material');
  expect(screen.getByRole('option', { name: '采购企业 · 纸 (A4)' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: '另一采购企业 · 笔 (PEN)' })).toBeNull();
});

it('uses the second product buyer rather than the first admitted buyer when adding a SKU', async () => {
  product.tenantId = 'buyer2';
  await open(); fireEvent.click(screen.getByRole('button', { name: '新增规格' }));
  expect(screen.queryByRole('option', { name: '采购企业 · 纸 (A4)' })).toBeNull();
  expect(screen.getByRole('option', { name: '另一采购企业 · 笔 (PEN)' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('关联物料'), { target: { value: 'material2' } });
  fireEvent.change(screen.getByLabelText('协议单价（元）'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: '保存规格' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(`${base}/product/skus`, expect.objectContaining({ materialId: 'material2' })));
});

it('does not offer private buyer materials for public SKUs but preserves their historical association', async () => {
  product.tenantId = null; product.scope = 'public';
  await open(); fireEvent.click(screen.getByRole('button', { name: '编辑规格' }));
  expect(screen.getByLabelText('关联物料')).toHaveValue('material');
  expect(screen.getByRole('option', { name: 'material（原有关联）' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: '采购企业 · 纸 (A4)' })).toBeNull();
  expect(screen.queryByRole('option', { name: '另一采购企业 · 笔 (PEN)' })).toBeNull();
});
