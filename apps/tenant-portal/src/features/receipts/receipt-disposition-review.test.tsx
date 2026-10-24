import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { ReceiptDispositionReview } from './receipt-disposition-review';

const fixture = vi.hoisted(() => ({ manage: true, review: true, get: vi.fn(), post: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (p: string) =>
  p === 'buyer:receipt:manage' ? fixture.manage : p === 'buyer:workflow:review' ? fixture.review : true }) }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: { get: fixture.get, post: fixture.post } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); fixture.manage = true; fixture.review = true; });
const open = async (record: unknown = null) => {
  fixture.get.mockResolvedValue({ data: { data: record } });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ReceiptDispositionReview receiptId="receipt-1" onClose={vi.fn()} />
  </QueryClientProvider>);
  await waitFor(() => expect(fixture.get).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('正在加载复核记录…')).toBeNull());
};

it('requires an explicit decision, reason and evidence before submitting', async () => {
  await open();
  expect((screen.getByRole('button', { name: '登记复核' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('让步接收'));
  fireEvent.change(screen.getByLabelText('复核原因'), { target: { value: '实物经技术部门确认可以使用' } });
  expect((screen.getByRole('button', { name: '登记复核' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('复核凭证'), { target: { value: 'QA-001' } });
  fixture.post.mockResolvedValue({ data: { data: { decision: '让步接收', reason: '实物经技术部门确认可以使用', evidenceNo: 'QA-001', reviewedBy: 'buyer-1' } } });
  fireEvent.click(screen.getByRole('button', { name: '登记复核' }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith('/api/v1/buyer/receipts/receipt-1/disposition-review', {
    decision: '让步接收', reason: '实物经技术部门确认可以使用', evidenceNo: 'QA-001',
  }));
});

it('requires both permissions and never offers a write action to a single-permission account', async () => {
  fixture.review = false;
  await open();
  expect(screen.queryByRole('button', { name: '登记复核' })).toBeNull();
  expect(fixture.post).not.toHaveBeenCalled();
});

it('shows immutable rejection history and never treats it as approval', async () => {
  await open({ decision: '维持退货换货', reason: '安全验收不通过', evidenceNo: 'QA-002', reviewedBy: 'buyer-2', reviewedAt: '2026-10-24T10:00:00Z' });
  expect(screen.getByText('维持退货换货')).toBeTruthy();
  expect(screen.getByText('安全验收不通过')).toBeTruthy();
  expect(screen.getByText('QA-002')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '登记复核' })).toBeNull();
});

it('keeps server rejection visible without showing success', async () => {
  await open();
  fireEvent.click(screen.getByLabelText('维持退货换货'));
  fireEvent.change(screen.getByLabelText('复核原因'), { target: { value: '仍需退换' } });
  fireEvent.change(screen.getByLabelText('复核凭证'), { target: { value: 'QA-003' } });
  fixture.post.mockRejectedValue({ response: { data: { message: '已结算或归档，不得复核' } } });
  fireEvent.click(screen.getByRole('button', { name: '登记复核' }));
  expect(await screen.findByText('已结算或归档，不得复核')).toBeTruthy();
  expect(screen.queryByText('复核已登记')).toBeNull();
});
