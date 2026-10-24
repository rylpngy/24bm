import { createElement } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { productMediaPath, uploadMallProductImage, useMallProductImages } from './mall-product-media';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('./http-client', () => ({ axiosInstance: api }));
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:verified-image'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);
}

it('uploads through product-scoped ticket, bytes and registration, never a provided remote URL', async () => {
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const file = Object.assign(new File([bytes], 'photo.png', { type: 'image/png' }), { arrayBuffer: async () => bytes });
  api.post.mockResolvedValueOnce({ data: { data: { storageKey: 'mall-product-media/random', token: 'single-use', uploadUrl: 'https://untrusted.test/upload' } } })
    .mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { data: [] } });
  await uploadMallProductImage('p', file);
  expect(api.post.mock.calls.map(call => call[0])).toEqual([
    '/api/v1/supplier/mall/products/p/media/upload-ticket', '/api/v1/supplier/mall/products/p/media/upload-sink', '/api/v1/supplier/mall/products/p/media',
  ]);
  expect(api.post.mock.calls[1][2].params).toEqual({ storageKey: 'mall-product-media/random', token: 'single-use' });
});

it('rejects unsupported files without requesting tickets', async () => {
  await expect(uploadMallProductImage('p', new File(['<svg/>'], 'script.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG/JPEG');
  expect(api.post).not.toHaveBeenCalled();
});

it('keeps buyer-review traffic on its explicit manage-protected endpoint', () => {
  expect(productMediaPath('buyer-review', 'p')).toBe('/api/v1/buyer/mall/products/p/review-media');
  expect(productMediaPath('buyer', 'p')).toBe('/api/v1/buyer/mall/products/p/media');
});

it('never registers an unsuccessful upload', async () => {
  const file = Object.assign(new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' }), { arrayBuffer: async () => new ArrayBuffer(5) });
  api.post.mockResolvedValueOnce({ data: { data: { storageKey: 'key', token: 'token' } } }).mockRejectedValueOnce(new Error('upload failed'));
  await expect(uploadMallProductImage('p', file)).rejects.toThrow('upload failed');
  expect(api.post).toHaveBeenCalledTimes(2);
});

it('fetches exact authenticated media endpoint and revokes its blob on unmount', async () => {
  api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/content') ? new Blob(['png'], { type: 'image/png' }) : {
    data: [{ id: 'm', fileName: 'photo.png', contentUrl: 'https://untrusted.test/private', main: true }],
  } }));
  const { result, unmount } = renderHook(() => useMallProductImages('p', 'buyer'), { wrapper });
  await waitFor(() => expect(result.current.images).toHaveLength(1));
  expect(api.get.mock.calls[1][0]).toBe('/api/v1/buyer/mall/products/p/media/m/content');
  expect(result.current.images[0].src).toBe('blob:verified-image');
  unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:verified-image');
});

it('does not create image URLs for non-image content', async () => {
  api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/content') ? new Blob(['<html>'], { type: 'text/html' }) : { data: [{ id: 'm' }] } }));
  const { result } = renderHook(() => useMallProductImages('p', 'buyer'), { wrapper });
  await waitFor(() => expect(result.current.imageError).toBe(true));
  expect(result.current.images).toEqual([]); expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('overrides global retries so failed media lists do not repeatedly request each product', async () => {
  api.get.mockRejectedValue(new Error('unavailable'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
  const provider = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const { result, rerender } = renderHook(() => useMallProductImages('p', 'buyer'), { wrapper: provider });
  await waitFor(() => expect(result.current.query.isError).toBe(true));
  rerender();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(result.current.images).toEqual([]);
});
