import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierMallAfterSalesPanel } from './mall-after-sales-panel';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api }));
const row = { id: 'a', orderId: 'o', orderLineId: 'l', type: '退货', quantity: 1, reason: '商品破损', status: '处理中' };
beforeEach(() => { api.get.mockResolvedValue({ data: { data: [row] } }); api.put.mockResolvedValue({ data: { data: [] } }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(canManage = true) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><SupplierMallAfterSalesPanel canManage={canManage} /></QueryClientProvider>);
}

it('requires reply and evidence before submitting for buyer confirmation', async () => {
  show();
  fireEvent.click(await screen.findByText('提交买方确认'));
  expect(screen.getByRole('alert')).toHaveTextContent('处理回复');
  fireEvent.change(screen.getByLabelText('处理回复 a'), { target: { value: '已签收退货' } });
  fireEvent.click(screen.getByText('提交买方确认'));
  expect(screen.getByRole('alert')).toHaveTextContent('凭据编号');
  expect(api.put).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('处理凭据编号 a'), { target: { value: 'RETURN-001' } });
  fireEvent.click(screen.getByText('提交买方确认'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/supplier/mall/after-sales/a', {
    status: '已完成', reply: '已签收退货', evidenceNo: 'RETURN-001',
  }));
});

it('has no handling controls for read-only members or cases awaiting confirmation', async () => {
  show(false);
  await screen.findByText('商品破损');
  expect(screen.queryByText('提交买方确认')).toBeNull();
  expect(screen.queryByText('拒绝申请')).toBeNull();
  cleanup();
  api.get.mockResolvedValue({ data: { data: [{ ...row, status: '待买方确认' }] } });
  show();
  await screen.findByText('待买方确认');
  expect(screen.queryByText('提交买方确认')).toBeNull();
});

it('preserves server rejection and hides stale rows when the list fails', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
  expect(screen.queryByText('商品破损')).toBeNull();
});

it('shows scoped history with processing evidence', async () => {
  api.get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/history') ? [
    { id: 'e', actorRole: 'supplier', fromStatus: '处理中', toStatus: '待买方确认', note: '退货签收', evidenceNo: 'TRACK-1', createdAt: '2026-10-24' },
  ] : [row] } }));
  show();
  fireEvent.click(await screen.findByText('办理历史'));
  expect(await screen.findByText('凭据：TRACK-1')).toBeTruthy();
});
