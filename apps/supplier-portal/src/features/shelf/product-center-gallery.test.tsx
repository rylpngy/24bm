import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductCenter } from './product-center';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api, useSupplierMallMaterials: () => ({ data: { data: [] } }) }));
vi.mock('../../../../../packages/api-client/src/http-client', () => ({ axiosInstance: api }));

const root = '/api/v1/supplier/mall/products';
const mediaPath = `${root}/product/media`;
const listingKey = ['/api/v1/supplier/mall/listings'];
const bytes = new Uint8Array([137, 80, 78, 71]);
const media = (id: string, main = false) => ({ id, fileName: `${id}.png`, contentType: 'image/png', contentSize: 4, sortOrder: 0, main, contentUrl: 'not-trusted' });
let images: ReturnType<typeof media>[];
let product: { id: string; name: string; status: string; mainImageKey: string | null; skus: { id: string; status: string; price: number }[] };
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:catalog-image');
    static revokeObjectURL = vi.fn();
  });
  product = { id: 'product', name: '复印纸', status: '在架', mainImageKey: 'original-main', skus: [{ id: 'sku', status: '在架', price: 10 }] };
  images = [media('front', true), media('back')];
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(listingKey, { data: [{ id: 'sku', productStatus: '在架' }] });
  api.get.mockImplementation(async (url: string) => {
    if (url === root) return { data: { data: [structuredClone(product)] } };
    if (url === mediaPath) return { data: { data: structuredClone(images) } };
    if (url.startsWith(`${mediaPath}/`) && url.endsWith('/content')) return { data: new Blob([bytes], { type: 'image/png' }) };
    throw new Error(`Unexpected GET ${url}`);
  });
  api.post.mockImplementation(async (url: string) => {
    if (url === `${mediaPath}/upload-ticket`) return { data: { data: { storageKey: 'uploaded-key', token: 'upload-token' } } };
    if (url === `${mediaPath}/upload-sink`) return { data: { data: null } };
    if (url === mediaPath) {
      images = [...images, media('uploaded')]; product.status = '草稿';
      return { data: { data: structuredClone(images) } };
    }
    throw new Error(`Unexpected POST ${url}`);
  });
  api.put.mockImplementation(async (url: string) => {
    if (url === `${mediaPath}/back/main`) {
      images = images.map(image => ({ ...image, main: image.id === 'back' }));
      product.mainImageKey = 'back-key'; product.status = '草稿';
      return { data: { data: structuredClone(images) } };
    }
    throw new Error(`Unexpected PUT ${url}`);
  });
  api.delete.mockImplementation(async (url: string) => {
    if (url === `${mediaPath}/front`) {
      images = images.filter(image => image.id !== 'front'); product.status = '草稿'; product.mainImageKey = null;
      return { data: { data: structuredClone(images) } };
    }
    throw new Error(`Unexpected DELETE ${url}`);
  });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
async function show(canManage = true) {
  render(<QueryClientProvider client={client}><ProductCenter canManage={canManage} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: canManage ? '维护规格' : '查看规格' }));
  await screen.findByText('front.png');
}
function selectedFile() {
  const file = new File([bytes], 'photo.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  return file;
}

it('uploads the selected bytes through ticket, upload sink and registration, then refreshes rereview and shelf state', async () => {
  await show();
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [selectedFile()] } });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${mediaPath}/upload-ticket`, { fileName: 'photo.png' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${mediaPath}/upload-sink`, bytes.buffer, {
    params: { storageKey: 'uploaded-key', token: 'upload-token' }, headers: { 'Content-Type': 'application/octet-stream' },
  }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(mediaPath, { storageKey: 'uploaded-key' }));
  expect(await screen.findByText('图片已更新，商品须重新提交审核')).toBeTruthy();
  expect(await screen.findByText('草稿')).toBeTruthy();
  expect(screen.getByRole('button', { name: '提交审核' })).toBeTruthy();
  await waitFor(() => expect(client.getQueryState(listingKey)?.isInvalidated).toBe(true));
  expect(api.put).not.toHaveBeenCalled();
});

it('selects a real main image and refreshes the product approval state', async () => {
  await show();
  fireEvent.click(screen.getByRole('button', { name: '设为主图' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${mediaPath}/back/main`));
  expect(await screen.findByText('草稿')).toBeTruthy();
  expect(await screen.findByText('图片已更新，商品须重新提交审核')).toBeTruthy();
  const row = screen.getByText('back.png').closest('li')!;
  expect(within(row).getByText('主图')).toBeTruthy();
  expect(product.mainImageKey).toBe('back-key');
});

it('requires confirmation before removal and refreshes the draft status without pretending to republish', async () => {
  await show();
  fireEvent.click(screen.getByRole('button', { name: '删除图片 front.png' }));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: '删除商品图片' })).getByRole('button', { name: '确定' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`${mediaPath}/front`));
  expect(await screen.findByText('草稿')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText('front.png')).toBeNull());
  expect(screen.getByRole('button', { name: '提交审核' })).toBeTruthy();
  expect(api.put).not.toHaveBeenCalled();
});

it('keeps real server rejection visible and does not claim a successful image or approval update', async () => {
  api.post.mockRejectedValue({ response: { data: { message: '上传票据已过期' } } });
  await show();
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [selectedFile()] } });
  expect(await screen.findByText('上传票据已过期')).toBeTruthy();
  expect(screen.queryByText('图片已更新，商品须重新提交审核')).toBeNull();
  expect(screen.queryByText('草稿')).toBeNull();
  expect(client.getQueryState(listingKey)?.isInvalidated).toBe(false);
});

it('allows image viewing but exposes no image writes to a read-only supplier', async () => {
  await show(false);
  expect(await screen.findByRole('img', { name: '复印纸' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '上传图片' })).toBeNull();
  expect(screen.queryByRole('button', { name: '设为主图' })).toBeNull();
  expect(screen.queryByRole('button', { name: /删除图片/ })).toBeNull();
  expect(api.post).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
});

it('serializes image writes with product editing and navigation until the upload settles', async () => {
  let release!: (value: unknown) => void;
  api.post.mockImplementation((url: string) => url.endsWith('/upload-ticket')
    ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ data: { data: [] } }));
  await show();
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [selectedFile()] } });
  await waitFor(() => expect(screen.getByRole('button', { name: '编辑商品' })).toBeDisabled());
  expect(screen.getByRole('button', { name: '编辑规格' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '返回商品中心' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '新建商品' })).toBeDisabled();
  release({ data: { data: null } });
  expect(await screen.findByText('未取得有效的图片上传票据')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: '编辑商品' })).not.toBeDisabled());
});
