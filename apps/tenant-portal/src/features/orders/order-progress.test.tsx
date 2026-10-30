import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrdersPage } from './orders-page';

const fixture = vi.hoisted(() => ({ delivered: true,status:'已收货',count:1 }));
vi.mock('./order-settlement',()=>({BuyerOrderSettlement:()=> <p>订单清算操作样本</p>}));
vi.mock('./order-after-sales',()=>({OrderAfterSales:()=> <p>订单售后操作样本</p>}));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => true }) }));
vi.mock('@24bid/api-client', () => ({
  useOrderCancellation: () => ({data:{blockers:['已完成订单不能取消'],items:[],total:0,actorId:'viewer'},loading:false,loadError:false,error:'',busy:false,page:1,setPage:vi.fn(),refresh:vi.fn(),act:vi.fn()}),
  usePurchaseOrderList: () => ({ data: { data: Array.from({length:fixture.count},(_,index)=>({ id: index===0?'received-order':`received-order-${index+1}`, status: fixture.status, amount: 1200 })) } }),
  useBuyerSupplierList: () => ({ data: { data: [] } }),
  useBuyerReceiptList: () => ({ data: { data: [] } }),
  useBuyerDeliveryList: () => ({ data: { data: fixture.delivered ? [{ id: 'batch', orderId: 'received-order', createdAt: '2026-10-23T10:00:00Z' }] : [] } }),
}));
afterEach(()=>{cleanup();fixture.count=1;});
const open = () => {
  render(<OrdersPage onNavigate={vi.fn()} />);
  fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]);
};
describe('order fulfillment progress', () => {
  it('retains mainline settlement and after-sales in their respective tabs', () => {
    fixture.status='已收货'; open();
    expect(screen.queryByText('订单清算操作样本')).not.toBeInTheDocument();
    expect(screen.queryByText('订单售后操作样本')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消与清算' }));
    expect(screen.getByText('订单清算操作样本')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '退换与售后' }));
    expect(screen.getByText('订单售后操作样本')).toBeVisible();
    expect(screen.getByText('订单清算操作样本')).not.toBeVisible();
  });
  it('preserves pagination sequence and full-number search in the compact ledger', () => {
    fixture.status='已收货'; fixture.count=9;
    render(<OrdersPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'下一页'}));
    const rows=within(screen.getByRole('table',{name:'采购订单列表'})).getAllByRole('row');
    expect(rows).toHaveLength(2);expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent(/^9$/);
    fireEvent.change(screen.getByPlaceholderText('按订单号 / 询比号 / 供应商搜索'),{target:{value:'received-order-2'}});
    fireEvent.click(screen.getByRole('button',{name:'搜索'}));
    const filtered=within(screen.getByRole('table',{name:'采购订单列表'})).getAllByRole('row');
    expect(filtered).toHaveLength(2);expect(within(filtered[1]).getAllByRole('cell')[0]).toHaveTextContent(/^1$/);
    expect(within(filtered[1]).getByTitle('received-order-2')).toBeVisible();
  });
  it('keeps list actions on one line and retains receipt navigation', () => {
    fixture.status='已发货'; fixture.delivered=true;
    const navigate=vi.fn(); render(<OrdersPage onNavigate={navigate} />);
    const table=screen.getByRole('table',{name:'采购订单列表'});
    expect(table).toHaveClass('table-fixed','whitespace-nowrap');
    expect(table.querySelectorAll('col')).toHaveLength(7);
    expect(within(table).getByTitle('received-order')).toHaveClass('truncate');
    const receive=within(table).getByRole('button',{name:'去验收'});
    expect(receive).toHaveClass('shrink-0','whitespace-nowrap');
    expect(receive.closest('td')).toHaveClass('sticky','right-0');
    expect(within(table).getByRole('button',{name:'详情'})).toHaveClass('w-14');
    fireEvent.click(receive); expect(navigate).toHaveBeenCalledWith('receipts');
  });
  it('separates logistics, receipt and cancellation information from the basic page', () => {
    fixture.status='已收货'; fixture.delivered=true; open();
    expect(screen.getByText('订单信息')).toBeVisible();
    expect(screen.getByText('物流信息 · batch')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'发货物流'}));
    expect(screen.getByText('物流信息 · batch')).toBeVisible();
    expect(screen.getByText('订单信息')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'采购明细'}));
    expect(screen.getByText('暂无订单行项明细。')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'收货验收'}));
    expect(screen.getByText('暂无收货验收记录。')).toBeVisible();
  });
  it('uses the registration date when actual shipping date was not entered', () => {
    fixture.status='已收货';
    fixture.delivered = true;
    open();
    expect(screen.getByText('登记于 2026-10-23')).toBeTruthy();
    expect(screen.queryByText('待进行')).toBeNull();
  });
  it('does not show a received order as pending when document dates are unavailable', () => {
    fixture.status='已收货';
    fixture.delivered = false;
    open();
    expect(screen.queryByText('待进行')).toBeNull();
    expect(screen.getAllByText('已完成，时间未登记').length).toBe(3);
  });
  it('does not retain future fulfillment obligations on a cancelled order',()=>{fixture.status='已取消';fixture.delivered=false;open();expect(screen.getByText(/待收总量 0/)).toBeTruthy();expect(screen.queryByText('待进行')).toBeNull();expect(screen.getAllByText('订单已取消，不再履行').length).toBeGreaterThan(0);});
});
