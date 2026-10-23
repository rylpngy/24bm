import { expect, it, vi } from 'vitest';
import { customInstance } from '../../../../../packages/api-client/src/http-client';
import { getSupplierExitItems, isSupplierExitItemsPage, supplierExitItemsKey } from '../../../../../packages/api-client/src/supplier-exit-items';
vi.mock('../../../../../packages/api-client/src/http-client', () => ({ customInstance: vi.fn() }));
it('uses the agreed kind and fixed server page size with cancellation', async () => {
  const signal = new AbortController().signal;
  await getSupplierExitItems('rel/a', 'payment-verification', 2, signal);
  expect(customInstance).toHaveBeenCalledWith({ url: '/api/v1/buyer/suppliers/rel%2Fa/exit-items',
    method: 'GET', params: { kind: 'payment-verification', page: 2, pageSize: 10 }, signal });
});
it('isolates cached pages by relation, kind and page', () => {
  expect(supplierExitItemsKey('a', 'uninvoiced', 1)).not.toEqual(supplierExitItemsKey('b', 'uninvoiced', 1));
  expect(supplierExitItemsKey('a', 'uninvoiced', 1)).not.toEqual(supplierExitItemsKey('a', 'payment-verification', 1));
  expect(supplierExitItemsKey('a', 'uninvoiced', 1)).not.toEqual(supplierExitItemsKey('a', 'uninvoiced', 2));
});
it('accepts explicitly unknown amounts without converting them to zero', () => {
  expect(isSupplierExitItemsPage({ items: [{ id: 'x', orderId: 'o', invoiceId: null, label: 'O001', status: '待核对',
    amount: 100, invoicedAmount: null, paidAmount: null, remainingAmount: null, reason: '待核对', handlerLabel: '财务岗位' }],
  total: 1, page: 1, pageSize: 10 }, 1)).toBe(true);
});
it.each([undefined, {}, { items: [], total: -1, page: 1, pageSize: 10 },
  { items: [], total: 0, page: 2, pageSize: 10 }, { items: [], total: 0, page: 1, pageSize: 20 },
  { items: [{}], total: 1, page: 1, pageSize: 10 }])('rejects incomplete or mismatched page responses %#', data => {
  expect(isSupplierExitItemsPage(data, 1)).toBe(false);
});
