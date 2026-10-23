import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QualificationExpiryLedger } from './qualification-expiry-ledger';
const mocks = vi.hoisted(() => ({ query: vi.fn(), retry: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ useQualificationLedgerList: mocks.query }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('passes filters and server pagination and opens the buyer relation', () => {
  mocks.query.mockReturnValue({ data: { data: { items: [{ relationId: 'relation-a', qualificationId: 'q', supplierName: '企业甲', expiryState: 'expired' }], page: 1, total: 9 } }, refetch: mocks.retry });
  const open = vi.fn(); render(<QualificationExpiryLedger onOpen={open} />);
  fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]);
  expect(open).toHaveBeenCalledWith('relation-a');
  fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
  expect(mocks.query).toHaveBeenLastCalledWith({ state: 'all', keyword: '', page: 2, pageSize: 8 });
  fireEvent.change(screen.getByLabelText('到期状态'), { target: { value: 'expired' } });
  expect(mocks.query).toHaveBeenLastCalledWith({ state: 'expired', keyword: '', page: 1, pageSize: 8 });
});
it('does not display stale rows as a successful response when the request fails', () => {
  mocks.query.mockReturnValue({ isError: true, data: { data: { items: [{ supplierName: 'stale' }] } }, refetch: mocks.retry });
  render(<QualificationExpiryLedger onOpen={() => {}} />);
  expect(screen.getByRole('alert').textContent).toContain('加载失败');
  expect(screen.queryByText('stale')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '刷新到期台账' }));
  expect(mocks.retry).toHaveBeenCalledOnce();
});
