import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { OrderAfterSales } from './order-after-sales';
vi.mock('../mall/mall-after-sales-panel', () => ({
  BuyerMallAfterSalesPanel: ({ orderId }: { orderId: string }) => (
    <p>售后订单 {orderId}</p>
  ),
  BuyerMallAfterSalesRequestForm: () => <p>填写售后申请</p>,
}));
afterEach(cleanup);
describe('order after-sales entry', () => {
  it('opens actual order-scoped records and application separately', () => {
    render(
      <OrderAfterSales
        orderId="o"
        status="已收货"
        lines={[{ id: 'l', quantity: 1 }]}
        canPurchase
      />,
    );
    expect(screen.queryByText('售后订单 o')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '退换货与售后' }));
    expect(screen.getByText('售后订单 o')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '申请退换货 / 维修' }));
    expect(screen.getByText('填写售后申请')).toBeTruthy();
  });
  it('does not offer new physical responsibility on a settled order', () => {
    render(
      <OrderAfterSales
        orderId="o"
        status="已清算"
        lines={[{ id: 'l', quantity: 1 }]}
        canPurchase
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '退换货与售后' }));
    expect(
      screen.queryByRole('button', { name: '申请退换货 / 维修' }),
    ).toBeNull();
    expect(screen.getByText('售后订单 o')).toBeTruthy();
  });
});
