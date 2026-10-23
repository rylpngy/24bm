import { beforeEach, expect, it, vi } from 'vitest';
import { customInstance } from '../../../../../packages/api-client/src/http-client';
import { getSupplierExitRisk, isSupplierExitRisk, isSupplierExitBlocked } from '../../../../../packages/api-client/src/supplier-exit-risk';

vi.mock('../../../../../packages/api-client/src/http-client', () => ({ customInstance: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const clear = { unreceivedOrderCount: 0, unpaidInvoiceCount: 0, unpaidInvoiceFaceAmount: 0,
  unarchivedContractCount: 0, openAfterSalesCount: 0, uninvoicedOrderCount: 0,
  paymentVerificationRequiredCount: 0, remainingInvoiceAmount: 0, blocked: false };
it('uses the same endpoint with encoded relation IDs and cancellation', async () => {
  const signal = new AbortController().signal;
  vi.mocked(customInstance).mockResolvedValue({ data: clear });
  expect(await getSupplierExitRisk('rel/a', signal)).toEqual({ data: clear });
  expect(customInstance).toHaveBeenCalledWith({ url: '/api/v1/buyer/suppliers/rel%2Fa/exit-risk', method: 'GET', signal });
});
it('accepts a complete clear response only', () => {
  expect(isSupplierExitRisk(clear)).toBe(true);
  expect(isSupplierExitBlocked(clear)).toBe(false);
  for (const key of Object.keys(clear)) {
    const incomplete: Record<string, unknown> = { ...clear }; delete incomplete[key];
    expect(isSupplierExitRisk(incomplete)).toBe(false);
  }
});
it.each([null, {}, [], { ...clear, blocked: null }, { ...clear, remainingInvoiceAmount: '0' },
  { ...clear, remainingInvoiceAmount: NaN }, { ...clear, remainingInvoiceAmount: Infinity },
  { ...clear, unarchivedContractCount: 0.5 }, { ...clear, unpaidInvoiceCount: -1 }])('rejects malformed responses %#', value => {
  expect(isSupplierExitRisk(value)).toBe(false);
});
it('honors all numeric blockers even if the server blocked flag is false', () => {
  for (const field of Object.keys(clear).filter(key => key !== 'blocked')) {
    expect(isSupplierExitBlocked({ ...clear, [field]: 1 })).toBe(true);
  }
  expect(isSupplierExitBlocked({ ...clear, blocked: true })).toBe(true);
});
it('accepts a null remaining amount only for a blocked verification response', () => {
  const unknown = { ...clear, blocked: true, paymentVerificationRequiredCount: 1, remainingInvoiceAmount: null };
  expect(isSupplierExitRisk(unknown)).toBe(true);
  expect(isSupplierExitRisk({ ...unknown, blocked: false })).toBe(false);
  expect(isSupplierExitRisk({ ...unknown, paymentVerificationRequiredCount: 0 })).toBe(false);
});
