import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { PaymentLedgerPanel } from './payment-ledger-panel';

const state = vi.hoisted(() => ({
  record: vi.fn(), reverse: vi.fn(), denied: false, legacy: false,
  data: { invoiceAmount: 100, paidAmount: 20, remainingAmount: 80, warning: '', reconciliationRequired: false,
    milestones: [{ id: 'm1', name: '验收款', amount: 50, paid: 20, remaining: 30, reached: true, verified: true }, { id: 'm2', name: '尾款', amount: 50, paid: 0, remaining: 50, reached: false, verified: true }],
    entries: [{ id: 'p1', amount: 20, evidenceNo: 'B1', remark: '', createdBy: 'finance-user', createdAt: '2026-01-01T12:00:00' }] },
}));
vi.mock('@24bid/api-client', () => ({
  usePaymentLedger: () => ({ isError: state.denied, error: new Error('无权访问'), data: { data: { ...state.data, reconciliationRequired: state.legacy, warning: state.legacy ? '历史金额待核对' : '' } } }),
  useRecordPaymentAmount: () => ({ mutate: state.record, reset: vi.fn() }),
  useReversePayment: () => ({ mutate: state.reverse, reset: vi.fn() }),
}));
beforeEach(() => { state.record.mockClear(); state.reverse.mockClear(); state.denied = false; state.legacy = false; });
function show() { render(<QueryClientProvider client={new QueryClient()}><PaymentLedgerPanel invoiceId="invoice1" /></QueryClientProvider>); }
it('shows balances and restricts entry to the reached installment amount', () => {
  show();
  expect(screen.getByLabelText('本次付款金额').getAttribute('max')).toBe('30');
  expect(screen.getByLabelText('付款凭据号').hasAttribute('required')).toBe(true);
  expect((screen.getByRole('option', { name: /尾款/ }) as HTMLOptionElement).disabled).toBe(true);
  expect(screen.getByText('¥80.00')).toBeTruthy();
});
it('keeps the same idempotency key on retry, but changes it when the payload changes', () => {
  show();
  fireEvent.change(screen.getByLabelText('本次付款金额'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('付款凭据号'), { target: { value: 'B2' } });
  const form = screen.getByRole('button', { name: '确认登记付款' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(state.record.mock.calls[0][0]).toMatchObject({ amount: 10, evidenceNo: 'B2' });
  expect(state.record.mock.calls[0][0].idempotencyKey).toBe(state.record.mock.calls[1][0].idempotencyKey);
  fireEvent.change(screen.getByLabelText('本次付款金额'), { target: { value: '11' } }); fireEvent.submit(form);
  expect(state.record.mock.calls[2][0].idempotencyKey).not.toBe(state.record.mock.calls[0][0].idempotencyKey);
});
it('requires a reason and explicit confirmation before reversal', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '冲销' }));
  expect(state.reverse).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('冲销原因'), { target: { value: '录入金额有误' } });
  fireEvent.submit(screen.getByRole('button', { name: '确认冲销' }).closest('form')!);
  expect(state.reverse.mock.calls[0][0]).toMatchObject({ entryId: 'p1', reason: '录入金额有误' });
});
it('does not offer amount entry or reversal for unverified historical records', () => {
  state.legacy = true; show();
  expect(screen.getByRole('status').textContent).toContain('历史金额待核对');
  expect(screen.queryByLabelText('本次付款金额')).toBeNull();
  expect(screen.queryByRole('button', { name: '冲销' })).toBeNull();
});
it('hides cached ledger data on access failure', () => {
  state.denied = true; show();
  expect(screen.getByRole('status').textContent).toContain('无权访问');
  expect(screen.queryByText('B1')).toBeNull();
});
