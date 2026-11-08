import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RfqResultBuyer } from './rfq-result';

const result = vi.hoisted(() => ({ isLoading: false, isError: false, data: undefined }));
vi.mock('@24bid/api-client', () => ({ useRfqResult: () => result }));
afterEach(() => { cleanup(); result.isError = false; result.isLoading = false; });

it('shows an actionable failure instead of silently hiding missing result data', () => {
  result.isError = true;
  render(<RfqResultBuyer rfqId="rfq-1" supplierNames={{}} />);
  expect(screen.getByText('结果加载失败，请刷新后重试。')).toBeTruthy();
});

it('does not announce a failure for an empty successful result', () => {
  const { container } = render(<RfqResultBuyer rfqId="rfq-1" supplierNames={{}} />);
  expect(container.textContent).toBe('');
});
