import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ProductImage, ProductImageGallery } from './product-image';

afterEach(cleanup);
it('renders nothing for missing keys, external URLs or private object paths', () => {
  for (const src of [undefined, '', 'https://example.com/photo.png', 'tenant/private/key', 'data:image/png;base64,AAAA']) {
    const { container, unmount } = render(<ProductImage src={src} alt="纸张" />);
    expect(container.childElementCount).toBe(0); unmount();
  }
});
it('renders the authenticated blob without replacing failures with a fake image', () => {
  render(<ProductImage src="blob:real-image" alt="纸张" />);
  expect(screen.getByRole('img', { name: '纸张' })).toHaveAttribute('src', 'blob:real-image');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('图片加载失败');
});
it('selects actual gallery images and keeps stable framing', () => {
  render(<ProductImageGallery alt="纸张" images={[{ id: 'one', src: 'blob:one', main: true }, { id: 'two', src: 'blob:two' }]} />);
  expect(screen.getByRole('img', { name: '纸张' })).toHaveAttribute('src', 'blob:one');
  fireEvent.click(screen.getByRole('button', { name: '查看第2张商品图片' }));
  expect(screen.getByRole('img', { name: '纸张' })).toHaveAttribute('src', 'blob:two');
  expect(screen.getByRole('img', { name: '纸张' }).parentElement).toHaveStyle({ aspectRatio: '4 / 3' });
});
