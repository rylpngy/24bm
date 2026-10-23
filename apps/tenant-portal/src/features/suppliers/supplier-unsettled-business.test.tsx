import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierUnsettledBusiness } from './supplier-unsettled-business';

const mocks = vi.hoisted(() => ({
  can: vi.fn((_permission: string) => true), orders: vi.fn(), invoices: vi.fn(), contracts: vi.fn(), afterSales: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@24bid/api-client', () => ({ usePurchaseOrderList: mocks.orders, useBuyerPaymentList: mocks.invoices,
  useBuyerContractList: mocks.contracts, useBuyerMallAfterSales: mocks.afterSales }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: mocks.can }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function mount(orderCount = 1, invoiceCount = 1) {
  mocks.can.mockReturnValue(true);
  mocks.contracts.mockReturnValue({ data: { data: [
    { id: 'contract-open', contractNo: 'C001', supplierId: 'supplier', archiveStatus: '未归档', amount: 500 },
    { id: 'contract-archived', supplierId: 'supplier', archiveStatus: '已归档' },
    { id: 'contract-other', supplierId: 'other', archiveStatus: '未归档' },
  ] }, refetch: mocks.refresh });
  mocks.afterSales.mockReturnValue({ data: { data: [
    { id: 'after-open', supplierId: 'supplier', status: '待处理', type: '退货', reason: '破损', orderId: 'order-1' },
    { id: 'after-done', supplierId: 'supplier', status: '已完成' },
    { id: 'after-rejected', supplierId: 'supplier', status: '已拒绝' },
    { id: 'after-other', supplierId: 'other', status: '待处理' },
  ] }, refetch: mocks.refresh });
  mocks.orders.mockReturnValue({ data: { data: [
    { id: 'order-1', supplierId: 'supplier', status: '待发货', amount: 120 },
    { id: 'received', supplierId: 'supplier', status: '已收货' },
    { id: 'other', supplierId: 'other', status: '待发货' },
  ] }, refetch: mocks.refresh });
  mocks.invoices.mockReturnValue({ data: { data: [
    { id: 'inv-1', invoiceNo: 'INV001', supplierId: 'supplier', paymentStatus: '未付款', amount: 120 },
    { id: 'paid', supplierId: 'supplier', paymentStatus: '已付款' },
  ] }, refetch: mocks.refresh });
  return render(<SupplierUnsettledBusiness supplierId="supplier" orderCount={orderCount} invoiceCount={invoiceCount} />);
}
it('shows only this supplier unsettled records and links to the actual record', () => {
  mount();
  expect(screen.queryByText('received')).toBeNull();
  expect(screen.queryByText('other')).toBeNull();
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/?module=orders&recordId=order-1');
  fireEvent.click(screen.getByRole('tab', { name: /未付清发票/ }));
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/?module=invoices&recordId=inv-1');
  expect(screen.getByText(/不代表剩余应付余额/)).toBeTruthy();
  expect(screen.queryByText('paid')).toBeNull();
});
it('lists only this supplier unarchived contracts with a real contract detail link', () => {
  mount(); fireEvent.click(screen.getByRole('tab', { name: /未归档合同/ }));
  expect(mocks.contracts).toHaveBeenCalledWith({ supplierId: 'supplier' }, { query: { enabled: true } });
  expect(screen.getAllByText('C001').length).toBeGreaterThan(0);
  expect(screen.queryByText('contract-archived')).toBeNull();
  expect(screen.queryByText('contract-other')).toBeNull();
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/?module=contracts&recordId=contract-open');
});
it('lists open supplier after-sales without fabricated detail links', () => {
  mount(); fireEvent.click(screen.getByRole('tab', { name: /未结售后/ }));
  expect(screen.getAllByText('after-open').length).toBeGreaterThan(0);
  for (const id of ['after-done', 'after-rejected', 'after-other']) expect(screen.queryByText(id)).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});
it('never enables contract or after-sales requests without the corresponding permission', () => {
  const view = mount(); mocks.can.mockReturnValue(false);
  view.rerender(<SupplierUnsettledBusiness supplierId="supplier" orderCount={1} invoiceCount={1} />);
  expect(mocks.contracts).toHaveBeenLastCalledWith({ supplierId: 'supplier' }, { query: { enabled: false } });
  expect(mocks.afterSales).toHaveBeenLastCalledWith({ query: { enabled: false } });
  fireEvent.click(screen.getByRole('tab', { name: /未归档合同/ }));
  expect(screen.getByText(/无合同查看权限/)).toBeTruthy();
  expect(screen.queryByText('C001')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /未结售后/ }));
  expect(screen.getByText(/无订单查看权限/)).toBeTruthy();
  expect(screen.queryByText('after-open')).toBeNull();
});
it('shows explicit contract permission denial for a server 403 without cached rows', () => {
  const view = mount();
  mocks.contracts.mockReturnValue({ isError: true, error: { response: { status: 403 } },
    data: { data: [{ id: 'secret-contract', supplierId: 'supplier' }] }, refetch: mocks.refresh });
  view.rerender(<SupplierUnsettledBusiness supplierId="supplier" orderCount={1} invoiceCount={1} />);
  fireEvent.click(screen.getByRole('tab', { name: /未归档合同/ }));
  expect(screen.getByText(/无合同查看权限/)).toBeTruthy();
  expect(screen.queryByText('secret-contract')).toBeNull();
});
it('disables finance fetching and hides values when permission is absent', () => {
  const view = mount(0);
  mocks.can.mockImplementation(permission => permission !== 'buyer:invoice:read');
  view.rerender(<SupplierUnsettledBusiness supplierId="supplier" orderCount={0} invoiceCount={1} />);
  expect(mocks.invoices).toHaveBeenLastCalledWith({ supplierId: 'supplier' }, { query: { enabled: false } });
  expect(screen.getByText(/无发票查看权限/)).toBeTruthy();
  expect(screen.queryByText('INV001')).toBeNull();
});
it('reports failure without displaying stale records and allows retry', () => {
  const view = mount();
  mocks.orders.mockReturnValue({ isError: true, refetch: mocks.refresh, data: { data: [{ id: 'stale', supplierId: 'supplier' }] } });
  view.rerender(<SupplierUnsettledBusiness supplierId="supplier" orderCount={1} invoiceCount={0} />);
  expect(screen.getByText(/明细加载失败/)).toBeTruthy();
  expect(screen.queryByText('stale')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '刷新未结业务明细' }));
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it('warns about differences between risk counts and visible records', () => {
  mount(5);
  expect(screen.getByText(/可能存在数据权限限制或业务状态变化/)).toBeTruthy();
});
it('paginates records and resets the page when switching tabs', () => {
  const view = mount(6);
  mocks.orders.mockReturnValue({ data: { data: Array.from({ length: 6 }, (_, index) => ({
    id: `page-order-${index + 1}`, supplierId: 'supplier', status: '待发货', amount: 100,
  })) }, refetch: mocks.refresh });
  view.rerender(<SupplierUnsettledBusiness supplierId="supplier" orderCount={6} invoiceCount={1} />);
  expect(screen.queryByText('page-order-6')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
  expect(screen.getAllByText('page-order-6').length).toBeGreaterThan(0);
  expect(screen.queryByText('page-order-1')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /未付清发票/ }));
  expect(screen.getAllByText('INV001').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('tab', { name: /未收货订单/ }));
  expect(screen.getAllByText('page-order-1').length).toBeGreaterThan(0);
  expect(screen.queryByText('page-order-6')).toBeNull();
});
