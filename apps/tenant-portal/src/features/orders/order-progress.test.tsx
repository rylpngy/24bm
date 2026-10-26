import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrdersPage } from './orders-page';

const fixture = vi.hoisted(() => ({ delivered: true,status:'已收货' }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => true }) }));
vi.mock('@24bid/api-client', () => ({
  useOrderCancellation: () => ({data:{blockers:['已完成订单不能取消'],items:[],total:0,actorId:'viewer'},loading:false,loadError:false,error:'',busy:false,page:1,setPage:vi.fn(),refresh:vi.fn(),act:vi.fn()}),
  usePurchaseOrderList: () => ({ data: { data: [{ id: 'received-order', status: fixture.status, amount: 1200 }] } }),
  useBuyerSupplierList: () => ({ data: { data: [] } }),
  useBuyerReceiptList: () => ({ data: { data: [] } }),
  useBuyerDeliveryList: () => ({ data: { data: fixture.delivered ? [{ id: 'batch', orderId: 'received-order', createdAt: '2026-10-23T10:00:00Z' }] : [] } }),
}));
afterEach(cleanup);
const open = () => {
  render(<OrdersPage onNavigate={vi.fn()} />);
  fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]);
};
describe('order fulfillment progress', () => {
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
