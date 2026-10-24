import { expect, it, vi } from 'vitest';
import { customInstance } from './http-client';
import { createProcurementArchive, procurementExecutionUrl } from './procurement-execution';
vi.mock('./http-client', () => ({ customInstance: vi.fn() }));
it('encodes the project id and submits a snapshot remark without changing business state', async () => {
  expect(procurementExecutionUrl('rfq/1')).toBe('/api/v1/buyer/rfqs/rfq%2F1/execution');
  await createProcurementArchive('rfq/1', '核对完成');
  expect(customInstance).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/v1/buyer/rfqs/rfq%2F1/execution/archives', method: 'POST', data: { remark: '核对完成' },
  }));
});
