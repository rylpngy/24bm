import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PageErrorBoundary } from './page-error-boundary';

it('offers a visible recovery action when a page cannot render', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  function BrokenPage(): never { throw new Error('Chunk unavailable'); }
  try {
    render(<PageErrorBoundary><BrokenPage /></PageErrorBoundary>);
    expect(screen.getByRole('alert').textContent).toContain('页面加载失败');
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeTruthy();
  } finally {
    log.mockRestore();
  }
});
