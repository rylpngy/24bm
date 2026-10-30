import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersPage } from './orders-page';

const mutations = vi.hoisted(() => ({ confirm: vi.fn(), ship: vi.fn(), issue: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
vi.mock('./invoice-issuance-form',()=>({InvoiceIssuanceForm:({orderId,onClose,onSaved}:{orderId:string;onClose:()=>void;onSaved:()=>void})=><section aria-label="分次开票"><p>{orderId}</p><button onClick={onClose}>取消开票</button><button onClick={onSaved}>保存本次发票</button></section>}));
vi.mock('@24bid/api-client', () => ({
  useOrderCancellation: () => ({data:{blockers:[],items:[],total:0,actorId:'viewer'},loading:false,loadError:false,error:'',busy:false,page:1,setPage:vi.fn(),refresh:vi.fn(),act:vi.fn()}),
  useSupplierOrderList: () => ({ data: { data: [
    { id: 'confirm-me', status: '待供应商确认' }, { id: 'ship-me', status: '待发货', lineItems: [{ id: 'line-1', quantity: 10, description: '物料' }] }, { id: 'invoice-me', status: '已收货', amount: 1200 },
    { id: 'partial-me', status: '已发货', lineItems: [{ id: 'line-2', quantity: 10, description: '分批物料' }] },
  ] } }),
  useSupplierDeliveryList: () => ({ data: { data: [{ id: 'batch-1', orderId: 'partial-me', shippedQuantity: 4, trackingNo: 'FIRST', lineItems: [{ orderLineId: 'line-2', shippedQuantity: 4 }] }] } }),
  useSupplierOrderConfirm: () => ({ mutate: mutations.confirm }),
  useSupplierDeliveryCreate: () => ({ mutate: mutations.ship }),
  useSupplierInvoiceCreate: () => ({ mutate: mutations.issue }),
}));
afterEach(cleanup);

describe('supplier order actions', () => {
  const show = (props = {}) => render(<QueryClientProvider client={new QueryClient()}><OrdersPage {...props} /></QueryClientProvider>);
  it('offers the next batch and shows the remaining quantity and history', () => {
    show({ canShip: true });
    fireEvent.click(screen.getAllByRole('button', { name: '继续发货' })[0]);
    expect(screen.getAllByText(/剩余可发.*6/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FIRST/).length).toBeGreaterThan(0);
  });
  it('keeps details available to read-only users without write actions', () => {
    show();
    expect(screen.queryByRole('button', { name: '确认订单' })).toBeNull();
    expect(screen.queryByRole('button', { name: '登记发货' })).toBeNull();
    expect(screen.queryByRole('button', { name: '开具发票' })).toBeNull();
    expect(screen.getAllByRole('button', { name: '明细' }).length).toBeGreaterThan(0);
  });
  it('does not grant delivery or invoice permission along with order confirmation', () => {
    show({ canConfirm: true });
    expect(screen.getAllByRole('button', { name: '确认订单' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '登记发货' })).toBeNull();
    expect(screen.queryByRole('button', { name: '开具发票' })).toBeNull();
  });
  it('opens the scoped installment form for authorized invoice operators', () => {
    show({ canInvoice: true });
    fireEvent.click(screen.getAllByRole('button', { name: '开具发票' })[0]);
    expect(screen.getAllByRole('region',{name:'分次开票'}).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button',{name:'保存本次发票'})[0]);
    expect(screen.getByText('订单 invoice-me 本次发票已保存')).toBeTruthy();
  });
  it('does not silently discard an invalid zero shipment quantity', () => {
    show({ canShip: true });
    fireEvent.click(screen.getAllByRole('button', { name: '登记发货' })[0]);
    for (const input of screen.getAllByPlaceholderText('承运商')) fireEvent.change(input, { target: { value: '物流' } });
    for (const input of screen.getAllByPlaceholderText('运单号')) fireEvent.change(input, { target: { value: 'QA-001' } });
    for (const input of screen.getAllByPlaceholderText('发货数量')) fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getAllByRole('button', { name: '提交发货' })[0]);
    expect(mutations.ship).not.toHaveBeenCalled();
    expect(screen.getByText(/发货数量应为正整数/)).toBeTruthy();
  });
});
