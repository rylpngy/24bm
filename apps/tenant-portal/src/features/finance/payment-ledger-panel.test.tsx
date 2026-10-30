import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { PaymentLedgerPanel } from './payment-ledger-panel';
import type { PaymentLedgerSummary } from '@24bid/api-client/payment-ledger';

const state = vi.hoisted(() => ({
  record: vi.fn(), reverse: vi.fn(), denied: false, legacy: false, funding: undefined as PaymentLedgerSummary['funding'],
  data: { invoiceAmount: 100, paidAmount: 20, remainingAmount: 80, warning: '', reconciliationRequired: false,
    milestones: [{ id: 'm1', name: '验收款', amount: 50, paid: 20, remaining: 30, reached: true, verified: true }, { id: 'm2', name: '尾款', amount: 50, paid: 0, remaining: 50, reached: false, verified: true }],
    entries: [{ id: 'p1', amount: 20, evidenceNo: 'B1', remark: '', createdBy: 'finance-user', createdAt: '2026-01-01T12:00:00' }] },
}));
vi.mock('@24bid/api-client', () => ({
  usePaymentLedger: () => ({ isError: state.denied, error: new Error('无权访问'), data: { data: { ...state.data, funding: state.funding, reconciliationRequired: state.legacy, warning: state.legacy ? '历史金额待核对' : '' } } }),
  useRecordPaymentAmount: () => ({ mutate: state.record, reset: vi.fn() }),
  useReversePayment: () => ({ mutate: state.reverse, reset: vi.fn() }),
}));
beforeEach(() => { state.record.mockClear(); state.reverse.mockClear(); state.denied = false; state.legacy = false; state.funding = undefined; });
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
it('requires explicit funding amounts that equal this payment and includes the split in retries', () => {
  state.funding = { enabled: true, blocker: '', sources: [
    { fundId: 'a', code: 'A', name: '专项 A', allocatedAmount: 50, paidAmount: 0, remainingAmount: 50 },
    { fundId: 'b', code: 'B', name: '专项 B', allocatedAmount: 50, paidAmount: 0, remainingAmount: 50 },
  ], entries: [] };
  show();
  fireEvent.change(screen.getByLabelText('本次付款金额'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('付款凭据号'), { target: { value: 'BANK-FUND' } });
  const button = screen.getByRole('button', { name: '确认登记付款' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('付款资金来源 A'), { target: { value: '6' } });
  fireEvent.change(screen.getByLabelText('付款资金来源 B'), { target: { value: '4' } });
  expect(button.disabled).toBe(false);
  fireEvent.submit(button.closest('form')!);
  fireEvent.submit(button.closest('form')!);
  expect(state.record.mock.calls[0][0].fundingLines).toEqual([{ fundId: 'a', amount: 6 }, { fundId: 'b', amount: 4 }]);
  expect(state.record.mock.calls[0][0].idempotencyKey).toBe(state.record.mock.calls[1][0].idempotencyKey);
  fireEvent.change(screen.getByLabelText('付款资金来源 B'), { target: { value: '3' } });
  fireEvent.submit(button.closest('form')!);
  expect(state.record).toHaveBeenCalledTimes(2);
});
it('blocks payment while funding approval is pending', () => {
  state.funding = { enabled: true, blocker: '项目资金分摊审批中，暂不能登记付款', sources: [], entries: [] };
  show();
  expect(screen.getByText('项目资金分摊审批中，暂不能登记付款')).toBeTruthy();
  expect((screen.getByRole('button', { name: '确认登记付款' }) as HTMLButtonElement).disabled).toBe(true);
});
