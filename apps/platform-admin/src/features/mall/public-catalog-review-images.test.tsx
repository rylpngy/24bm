import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PublicCatalogReviewsPage } from './public-catalog-reviews-page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api }));
vi.mock('../../../../../packages/api-client/src/http-client', () => ({ axiosInstance: api }));
const root = '/api/v1/platform/mall/products';
const mediaPath = `${root}/public-product/media`;
let client: QueryClient;
let failImage: boolean;
let failList: boolean;
beforeEach(() => {
  vi.clearAllMocks(); failImage = false; failList = false;
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:public-review-image');
    static revokeObjectURL = vi.fn();
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  api.get.mockImplementation(async (url: string) => {
    if (url === `${root}/pending-review`) return { data: { data: [{ id: 'public-product', name: '公开复印纸', status: '待审核', scope: 'public', skus: [] }] } };
    if (url === mediaPath) {
      if (failList) throw new Error('Forbidden');
      return { data: { data: [{ id: 'photo', fileName: 'photo.png', contentType: 'image/png', contentSize: 4, main: true, contentUrl: 'https://untrusted.invalid/private-image' }] } };
    }
    if (url === `${mediaPath}/photo/content`) {
      if (failImage) throw new Error('Image unavailable');
      return { data: new Blob(['image'], { type: 'image/png' }) };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
async function show() {
  render(<QueryClientProvider client={client}><PublicCatalogReviewsPage canManage /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '审核商品' }));
}

it('mounts actual authenticated platform-scope image preview inside public product review', async () => {
  await show();
  const image = await screen.findByRole('img', { name: '公开复印纸' });
  expect(image).toHaveAttribute('src', 'blob:public-review-image');
  expect(api.get).toHaveBeenCalledWith(mediaPath, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(api.get).toHaveBeenCalledWith(`${mediaPath}/photo/content`, expect.objectContaining({ responseType: 'blob' }));
  expect(api.get.mock.calls.every(([url]) => url.startsWith('/api/v1/platform/mall/products/'))).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});

it('reports an image authorization failure and never substitutes a fake product image', async () => {
  failList = true;
  await show();
  expect(await screen.findByText('商品图片加载失败，请刷新后重试。')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('retries blob image loading after an error even when the media metadata has not changed', async () => {
  failImage = true;
  await show();
  expect(await screen.findByText('商品图片加载失败，请刷新后重试。')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  failImage = false;
  fireEvent.click(screen.getByRole('button', { name: '刷新商品图片' }));
  expect(await screen.findByRole('img', { name: '公开复印纸' })).toHaveAttribute('src', 'blob:public-review-image');
  await waitFor(() => expect(screen.queryByText('商品图片加载失败，请刷新后重试。')).toBeNull());
});
