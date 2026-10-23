import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { PaymentReviewsPage } from './payment-reviews-page';

const state = vi.hoisted(() => ({
  save: vi.fn(), denied: false, canRecord: true, list: vi.fn(), detailDenied: false,
  row: { invoiceId: 'i1', invoiceNo: 'LEGACY-001', paymentStatus: '部分付款', invoiceAmount: 100,
    ledgerAmount: null, findings: ['历史付款缺少金额流水'], noteCount: 1 },
}));
vi.mock('@24bid/api-client', () => ({
  usePaymentReviews: (params: unknown) => {
    state.list(params);
    return { isError: state.denied, error: new Error('无权访问'), data: { data: { items: [state.row], total: 11, pageSize: 10 } } };
  },
  usePaymentReview: () => ({ isError: state.detailDenied, error: new Error('核对权限已失效'), data: { data: {
    invoice: state.row, totalNotes: 1, canRecord: state.canRecord,
    notes: [{ id: 'n1', reportedPaidAmount: null, evidenceReference: 'ARCHIVE-001', explanation: '金额尚待核实', snapshot: '原始状态：部分付款', createdBy: 'finance-1', createdAt: '2026-10-23T09:00:00' }],
  } } }),
  useRecordPaymentReview: () => ({ mutate: state.save, reset: vi.fn() }),
}));
beforeEach(() => { state.save.mockClear(); state.list.mockClear(); state.denied = false; state.detailDenied = false; state.canRecord = true; });
function show() { render(<QueryClientProvider client={new QueryClient()}><PaymentReviewsPage onBack={vi.fn()} onInvoice={vi.fn()} /></QueryClientProvider>); }
function detail() { show(); fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]); }

it('shows unknown amounts explicitly and requests server pagination and status filters', () => {
  show(); expect(screen.getAllByText(/待核对/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(state.list).toHaveBeenLastCalledWith({ page: 2, keyword: '', paymentStatus: '' });
  fireEvent.change(screen.getByLabelText('付款状态'), { target: { value: '部分付款' } });
  expect(state.list).toHaveBeenLastCalledWith({ page: 1, keyword: '', paymentStatus: '部分付款' });
});
it('records evidence without converting an unknown amount to zero and preserves retry keys', () => {
  detail();
  fireEvent.change(screen.getByLabelText('凭据编号或存档位置'), { target: { value: ' Bank-001 ' } });
  fireEvent.change(screen.getByLabelText('核对说明'), { target: { value: '核实凭据' } });
  const form = screen.getByRole('button', { name: '保存核对依据' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(state.save.mock.calls[0][0]).toMatchObject({ reportedPaidAmount: undefined, evidenceReference: 'Bank-001' });
  expect(state.save.mock.calls[0][0].idempotencyKey).toBe(state.save.mock.calls[1][0].idempotencyKey);
  fireEvent.change(screen.getByLabelText('凭据所载累计付款'), { target: { value: '35' } }); fireEvent.submit(form);
  expect(state.save.mock.calls[2][0].reportedPaidAmount).toBe(35);
  expect(state.save.mock.calls[2][0].idempotencyKey).not.toBe(state.save.mock.calls[0][0].idempotencyKey);
});
it('shows evidence and original snapshot without financial mutation controls', () => {
  detail(); expect(screen.getByText('凭据：ARCHIVE-001')).toBeTruthy();
  expect(screen.getByText('原始状态：部分付款')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /通过|补录余额|确认登记付款/ })).toBeNull();
});
it('hides the record form for read-only users', () => {
  state.canRecord = false; detail();
  expect(screen.queryByRole('button', { name: '保存核对依据' })).toBeNull();
  expect(screen.getByText('凭据：ARCHIVE-001')).toBeTruthy();
});
it('does not show cached list contents after a permission failure', () => {
  state.denied = true; show();
  expect(screen.getByText('无权访问')).toBeTruthy(); expect(screen.queryByText('LEGACY-001')).toBeNull();
});
it('does not show cached evidence or allow writing after detail permission failure', () => {
  state.detailDenied = true; detail();
  expect(screen.getByText('核对权限已失效')).toBeTruthy();
  expect(screen.queryByText('凭据：ARCHIVE-001')).toBeNull();
  expect(screen.queryByRole('button', { name: '保存核对依据' })).toBeNull();
});
