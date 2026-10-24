import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierProductGallery } from './supplier-product-gallery';

const api = vi.hoisted(() => ({ upload: vi.fn(), main: vi.fn(), remove: vi.fn(),
  state: { query: { data: [] as { id: string; fileName: string; main: boolean }[], isPending: false, isError: false, refetch: vi.fn() }, images: [], imageError: false } }));
vi.mock('@24bid/api-client/mall-product-media', () => ({ useMallProductImages: () => api.state,
  productMediaPath: () => '/api/v1/supplier/mall/products/p/media', uploadMallProductImage: api.upload,
  setMallProductMainImage: api.main, deleteMallProductImage: api.remove }));
beforeEach(() => { api.state.query.data = []; api.upload.mockResolvedValue([]); api.main.mockResolvedValue([]); api.remove.mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function show(canManage = true, onChanged = vi.fn()) {
  render(<QueryClientProvider client={new QueryClient()}><SupplierProductGallery productId="p" canManage={canManage} onChanged={onChanged} /></QueryClientProvider>);
  return onChanged;
}
it('does not create a placeholder image or expose uploads to readers', () => {
  show(false);
  expect(screen.queryByRole('img')).toBeNull(); expect(screen.getByText('暂无商品图片')).toBeTruthy();
  expect(screen.queryByText('上传图片')).toBeNull();
});
it('uploads the actual selected file and notifies the host after success', async () => {
  const changed = show(); const file = new File(['image'], 'photo.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [file] } });
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith('p', file));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(screen.getByText('图片已更新，商品须重新提交审核')).toBeTruthy();
});
it('does not pretend the upload succeeded on backend rejection', async () => {
  api.upload.mockRejectedValue(new Error('票据已失效')); const changed = show();
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  expect(await screen.findByText('票据已失效')).toBeTruthy(); expect(changed).not.toHaveBeenCalled();
});

it('respects host mutation locks', () => {
  render(<QueryClientProvider client={new QueryClient()}><SupplierProductGallery productId="p" canManage disabled /></QueryClientProvider>);
  expect(screen.getByRole('button', { name: '上传图片' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  expect(api.upload).not.toHaveBeenCalled();
});

it('reports busy state so the host cannot edit or submit the product during an upload', async () => {
  let finish!: () => void;
  api.upload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const report = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><SupplierProductGallery productId="p" canManage onBusyChange={report} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('选择商品图片'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  await waitFor(() => expect(report).toHaveBeenLastCalledWith(true));
  finish();
  await waitFor(() => expect(report).toHaveBeenLastCalledWith(false));
});
