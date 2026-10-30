import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { ReceiptsPage } from './receipts-page';

const mutation = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => true }) }));
vi.mock('@24bid/api-client', () => ({
  usePurchaseOrderList: () => ({ data: { data: [{ id: 'partial', status: '已发货', lineItems: [{ id: 'line', quantity: 10, description: '物料' }] }] } }),
  useBuyerReceiptList: () => ({ data: { data: [{ id: 'receipt-first', orderId: 'partial', receivedQuantity: 2, qualifiedQuantity: 2,
    lineItems: [{ orderLineId: 'line', receivedQuantity: 2, qualifiedQuantity: 2 }] }] } }),
  useBuyerDeliveryList: () => ({ data: { data: [{ id: 'delivery-first', orderId: 'partial', shippedQuantity: 7, trackingNo: 'FIRST',
    lineItems: [{ orderLineId: 'line', shippedQuantity: 7 }] }] } }),
  useBuyerSupplierList: () => ({ data: { data: [] } }),
  useBuyerReceiptCreate: () => mutation,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const open = () => {
  render(<QueryClientProvider client={new QueryClient()}><ReceiptsPage /></QueryClientProvider>);
  fireEvent.click(screen.getAllByTitle('登记收货验收')[0]);
};

it('keeps both receipt queues compact and preserves registration and historical detail entry', () => {
  render(<QueryClientProvider client={new QueryClient()}><ReceiptsPage /></QueryClientProvider>);
  const pending=screen.getByRole('table',{name:'待收货验收列表'});
  expect(pending).toHaveClass('table-fixed','whitespace-nowrap');
  expect(pending.querySelectorAll('col')).toHaveLength(8);
  expect(within(pending).getByTitle('partial')).toHaveClass('truncate');
  expect(within(pending).getByRole('button',{name:'验收登记'})).toHaveClass('shrink-0','whitespace-nowrap');
  fireEvent.click(screen.getByRole('tab',{name:/验收记录/}));
  const history=screen.getByRole('table',{name:'收货验收记录列表'});
  expect(history).toHaveClass('table-fixed','whitespace-nowrap');
  expect(history.querySelectorAll('col')).toHaveLength(9);
  const details=within(history).getByRole('button',{name:'详情'});
  expect(details).toHaveClass('w-14'); expect(details.closest('td')).toHaveClass('sticky','right-0');
  fireEvent.click(details); expect(screen.getByText('收货验收详情')).toBeVisible();
  expect(mutation.mutate).not.toHaveBeenCalled();
});

it('defaults the next receipt to shipped minus received and retains batch history', () => {
  open();
  expect(screen.getByLabelText('物料本批实收数量').getAttribute('value')).toBe('5');
  expect(screen.getByText(/收货批次 receipt-first/)).toBeTruthy();
  expect(screen.getByText(/发货批次 delivery-first/)).toBeTruthy();
});

it('rejects receiving more than shipped remaining and qualified more than received', () => {
  open();
  fireEvent.change(screen.getByLabelText('物料本批实收数量'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: '提交验收' }));
  expect(mutation.mutate).not.toHaveBeenCalled();
  expect(screen.getByText(/本批实收须大于零/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('物料本批实收数量'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('物料本批合格数量'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: '提交验收' }));
  expect(mutation.mutate).not.toHaveBeenCalled();
});

it('submits only the current batch with matching header and line quantities', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: '提交验收' }));
  expect(mutation.mutate).toHaveBeenCalledWith({ orderId: 'partial', data: expect.objectContaining({
    receivedQuantity: 5, qualifiedQuantity: 5, lineItems: [{ orderLineId: 'line', receivedQuantity: 5, qualifiedQuantity: 5 }],
  }) }, expect.any(Object));
});

it('retains quantities and quality notes when changing registration tabs', () => {
  open();
  fireEvent.change(screen.getByLabelText('物料本批实收数量'),{target:{value:'4'}});
  fireEvent.click(screen.getByRole('button',{name:'质检处置'}));
  fireEvent.change(screen.getByPlaceholderText('如:抽检结果、外观与数量核对情况'),{target:{value:'已抽检外观'}});
  expect(screen.getByLabelText('物料本批实收数量')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'订单与批次'}));
  expect(screen.getByText(/发货批次 delivery-first/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'数量核对'}));
  expect(screen.getByLabelText('物料本批实收数量')).toHaveValue(4);
  fireEvent.click(screen.getByRole('button',{name:'质检处置'}));
  expect(screen.getByPlaceholderText('如:抽检结果、外观与数量核对情况')).toHaveValue('已抽检外观');
  expect(mutation.mutate).not.toHaveBeenCalled();
});

it('opens historical receipts as separate categorized read-only detail pages', () => {
  render(<QueryClientProvider client={new QueryClient()}><ReceiptsPage /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('tab',{name:/验收记录/}));
  fireEvent.click(screen.getAllByRole('button',{name:'详情'})[0]);
  expect(screen.getByText('收货验收详情')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'验收明细'}));
  expect(screen.getByText('逐项验收明细')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'质检与处置'}));
  expect(screen.getByText('质检结论与处置')).toBeVisible();
  expect(screen.queryByRole('button',{name:'提交验收'})).not.toBeInTheDocument();
});
