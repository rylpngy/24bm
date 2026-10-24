import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MallReviewProductImages } from './mall-review-product-images';

const api = vi.hoisted(() => ({ hook: vi.fn(), refetch: vi.fn() }));
vi.mock('@24bid/api-client/mall-product-media', () => ({ useMallProductImages: api.hook }));
beforeEach(() => { api.hook.mockReturnValue({ images: [], imageError: false, query: { data: [], isPending: false, isError: false, refetch: api.refetch } }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('uses the management-only review path and never synthesizes an image', () => {
  render(<MallReviewProductImages productId="p" name="纸张" />);
  expect(api.hook).toHaveBeenCalledWith('p', 'buyer-review');
  expect(screen.queryByRole('img')).toBeNull(); expect(screen.getByText('暂无商品图片')).toBeTruthy();
});
it('shows actual authenticated preview images', () => {
  api.hook.mockReturnValue({ images: [{ id: 'm', src: 'blob:approved-by-boundary', main: true }], imageError: false,
    query: { data: [{ id: 'm' }], isPending: false, isError: false } });
  render(<MallReviewProductImages productId="p" name="纸张" />);
  expect(screen.getByRole('img', { name: '纸张' })).toHaveAttribute('src', 'blob:approved-by-boundary');
});
it('hides stale photos on permission failure and offers only an explicit retry', () => {
  api.hook.mockReturnValue({ images: [{ id: 'm', src: 'blob:stale' }], imageError: false,
    query: { data: [{ id: 'm' }], isPending: false, isError: true, refetch: api.refetch } });
  render(<MallReviewProductImages productId="p" />);
  expect(screen.queryByRole('img')).toBeNull(); expect(screen.getByRole('status')).toHaveTextContent('无权查看');
  fireEvent.click(screen.getByRole('button', { name: '刷新审核图片' })); expect(api.refetch).toHaveBeenCalledOnce();
});
