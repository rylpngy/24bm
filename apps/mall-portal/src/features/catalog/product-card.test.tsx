import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductCard } from './product-card';

const boundary = vi.hoisted(() => vi.fn());
vi.mock('./buyer-product-images', () => ({ BuyerProductImages: (props: unknown) => { boundary(props); return null; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('shows an honest empty state without querying media for historical products with no main image', () => {
  render(<ProductCard product={{ id: 'p', name: '纸张', fromPrice: 12 }} onOpen={vi.fn()} />);
  expect(screen.getByText('暂无商品图片')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull(); expect(boundary).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /纸张/ })).toBeTruthy();
});
it('passes a product identity to the authenticated image boundary, never the stored object key', () => {
  render(<ProductCard product={{ id: 'p', name: '纸张', mainImageKey: 'private/storage/key' }} onOpen={vi.fn()} />);
  expect(boundary).toHaveBeenCalledWith({ productId: 'p', name: '纸张', compact: true });
  expect(screen.queryByRole('img')).toBeNull();
});
