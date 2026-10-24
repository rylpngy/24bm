import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrdersPage } from './orders-page';

const fixture = vi.hoisted(() => ({ delivered: true }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => true }) }));
vi.mock('@24bid/api-client', () => ({
  usePurchaseOrderList: () => ({ data: { data: [{ id: 'received-order', status: '已收货', amount: 1200 }] } }),
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
    fixture.delivered = true;
    open();
    expect(screen.getByText('登记于 2026-10-23')).toBeTruthy();
    expect(screen.queryByText('待进行')).toBeNull();
  });
  it('does not show a received order as pending when document dates are unavailable', () => {
    fixture.delivered = false;
    open();
    expect(screen.queryByText('待进行')).toBeNull();
    expect(screen.getAllByText('已完成，时间未登记').length).toBe(3);
  });
});
