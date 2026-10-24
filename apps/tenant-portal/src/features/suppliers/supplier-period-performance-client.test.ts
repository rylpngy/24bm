import { beforeEach, expect, it, vi } from 'vitest';
import { getSupplierPeriodFulfillment, listSupplierPerformanceComparison } from '../../../../../packages/api-client/src/supplier-period-performance';
const http = vi.hoisted(() => vi.fn());
vi.mock('../../../../../packages/api-client/src/http-client', () => ({ customInstance: http }));
beforeEach(() => vi.clearAllMocks());
it('requires the comparison period and forwards cancellation', () => {
  const signal = new AbortController().signal; listSupplierPerformanceComparison('2026-Q4', signal);
  expect(http).toHaveBeenCalledWith({ url: '/api/v1/buyer/suppliers/performance-comparison', method: 'GET', params: { period: '2026-Q4' }, signal });
});
it('encodes supplier ID and sends the selected metrics period', () => {
  getSupplierPeriodFulfillment('s/1', '2026-10');
  expect(http).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/s%2F1/fulfillment-metrics', params: { period: '2026-10' } }));
});
