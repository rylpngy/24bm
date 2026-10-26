import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { ReceiptQualityResolution } from './receipt-quality-resolution';
const f = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  axiosInstance: { get: f.get, post: f.post },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const view = () => ({
  orderId: 'o',
  lines: [
    {
      receiptLineId: 'l',
      orderLineId: 'ol',
      description: '电脑',
      receivedQuantity: 2,
      qualifiedQuantity: 1,
      returnedQuantity: 0,
      exchangedQuantity: 0,
      unresolvedQuantity: 1,
      valid: true,
    },
  ],
  candidates: [
    { afterSalesId: 'a', orderLineId: 'ol', kind: '换货', quantity: 1 },
    {
      afterSalesId: 'foreign',
      orderLineId: 'another',
      kind: '退货',
      quantity: 1,
    },
  ],
  resolutions: [],
  canResolve: true,
  boundary: '不覆盖原始验收',
});
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ReceiptQualityResolution receiptId="r" />
    </QueryClientProvider>,
  );
}
it('links the exact receipt line and verified same-order-line case', async () => {
  f.get.mockResolvedValue({ data: { data: view() } });
  f.post.mockResolvedValue({
    data: { data: { ...view(), lines: [], candidates: [], canResolve: false } },
  });
  show();
  await screen.findByText('不覆盖原始验收');
  fireEvent.change(screen.getByLabelText('待核销验收行'), {
    target: { value: 'l' },
  });
  expect(screen.queryByRole('option', { name: /foreign/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('已完成实物核验的售后单'), {
    target: { value: 'a' },
  });
  fireEvent.change(screen.getByLabelText('核销依据'), {
    target: { value: '核对原件' },
  });
  fireEvent.click(screen.getByRole('button', { name: '确认质量核销' }));
  await waitFor(() =>
    expect(f.post).toHaveBeenCalledWith(
      '/api/v1/buyer/receipts/r/quality-resolutions',
      { receiptLineId: 'l', afterSalesId: 'a', reason: '核对原件' },
    ),
  );
});
it('never offers write actions when the server freezes the receipt', async () => {
  f.get.mockResolvedValue({ data: { data: { ...view(), canResolve: false } } });
  show();
  await screen.findByText('不覆盖原始验收');
  expect(screen.queryByRole('button', { name: '确认质量核销' })).toBeNull();
});
it('shows a failed read instead of a completed quality state', async () => {
  f.get.mockRejectedValue(new Error('offline'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
  expect(screen.queryByRole('button', { name: '确认质量核销' })).toBeNull();
});
