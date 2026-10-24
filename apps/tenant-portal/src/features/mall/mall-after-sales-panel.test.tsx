import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuyerMallAfterSalesPanel, BuyerMallAfterSalesRequestForm } from './mall-after-sales-panel';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api }));
const row = { id: 'a', orderId: 'o', orderLineId: 'l', type: '退货', quantity: 1, reason: '破损', status: '待买方确认', financialStatus: '退货财务待核对' };
beforeEach(() => { api.get.mockResolvedValue({ data: { data: [row] } }); api.post.mockResolvedValue({ data: { data: [] } }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(children: React.ReactNode) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>);
}

it('requires confirmation note and displays independent financial status', async () => {
  show(<BuyerMallAfterSalesPanel canPurchase />);
  fireEvent.click(await screen.findByText('确认处理结果'));
  expect(screen.getByRole('alert')).toHaveTextContent('填写确认');
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText('退货财务待核对')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('确认或撤回说明 a'), { target: { value: '已核实' } });
  fireEvent.click(screen.getByText('确认处理结果'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/mall/after-sales/a/confirm', { note: '已核实' }));
});

it('offers withdrawal only before supplier processing', async () => {
  api.get.mockResolvedValue({ data: { data: [{ ...row, status: '待处理' }] } });
  show(<BuyerMallAfterSalesPanel canPurchase />);
  fireEvent.change(await screen.findByLabelText('确认或撤回说明 a'), { target: { value: '取消申请' } });
  fireEvent.click(screen.getByText('撤回申请'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/mall/after-sales/a/withdraw', { note: '取消申请' }));
});

it('hides mutation controls for read-only users', async () => {
  show(<BuyerMallAfterSalesPanel />);
  await screen.findByText('破损');
  expect(screen.queryByText('确认处理结果')).toBeNull();
  expect(screen.queryByText('撤回申请')).toBeNull();
});

it('surfaces backend rejection without pretending completion', async () => {
  api.post.mockRejectedValue({ response: { data: { message: '售后状态已变更' } } });
  show(<BuyerMallAfterSalesPanel canPurchase />);
  fireEvent.change(await screen.findByLabelText('确认或撤回说明 a'), { target: { value: '确认' } });
  fireEvent.click(screen.getByText('确认处理结果'));
  expect(await screen.findByRole('alert')).toHaveTextContent('售后状态已变更');
  expect(screen.getByText('待买方确认')).toBeTruthy();
});

it('validates application and sends exact line without trusting a product binding', async () => {
  show(<BuyerMallAfterSalesRequestForm orderId="o" lines={[{ id: 'l', quantity: 5, description: '纸张' }]} />);
  fireEvent.submit(screen.getByRole('form', { name: '申请售后' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('售后原因'), { target: { value: '纸张破损' } });
  fireEvent.change(screen.getByLabelText('数量'), { target: { value: '2' } });
  fireEvent.submit(screen.getByRole('form', { name: '申请售后' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/mall/after-sales', {
    orderId: 'o', orderLineId: 'l', type: '退货', quantity: 2, reason: '纸张破损',
  }));
});

it.each([
  { actorId: 'supplier-operator-1', actorName: '', expected: '办理人：ID: supplier-operator-1' },
  { actorId: 'buyer-1', actorName: '张三', expected: '办理人：张三' },
  { actorId: null, actorName: '  ', expected: '办理人：未记录办理人' },
])('identifies the history actor: $expected', async ({ actorId, actorName, expected }) => {
  api.get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/history') ? [
    { id: 'event', actorId, actorName, actorRole: 'supplier', toStatus: '待买方确认', createdAt: '2026-10-24', evidenceNo: 'RETURN-1' },
  ] : [row] } }));
  show(<BuyerMallAfterSalesPanel />);
  fireEvent.click(await screen.findByRole('button', { name: '办理历史' }));
  expect(await screen.findByText(expected)).toBeTruthy();
  expect(screen.getByText('凭据：RETURN-1')).toBeTruthy();
});
