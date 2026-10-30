import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ContractScheduleSection } from './contract-schedule-section';

const state = vi.hoisted(() => ({ failed: false, loading: false, mutationFailed: false }));
vi.mock('@24bid/api-client', () => ({
  useContractScheduleLineItems: () => ({ data: { data: [] } }),
  useMonetaryContractMilestones: () => ({
    isError: state.failed, isLoading: state.loading,
    error: state.failed ? { response: { data: { message: '无权访问该合同' } } } : undefined,
    data: { data: [{ id: 'm1', name: '验收款', status: '待付', amount: 100, percent: 100, reached: true }] },
  }),
  useContractScheduleReach: () => ({ isError: state.mutationFailed, error: state.mutationFailed ? new Error('合同未生效') : undefined }),
  useContractScheduleGenerate: () => ({}),
}));
beforeEach(() => { state.failed = false; state.loading = false; state.mutationFailed = false; window.history.replaceState(null, '', '/'); });
function show() {
  render(<QueryClientProvider client={new QueryClient()}><ContractScheduleSection contractId="c1" /></QueryClientProvider>);
}
it('uses the finance ledger instead of a separate payment status action', () => {
  show();
  expect(screen.getByRole('link', { name: '付款台账' }).getAttribute('href')).toBe('?module=invoices');
  expect(screen.queryByRole('button', { name: '登记付款' })).toBeNull();
  expect(screen.getByText('待付')).toBeTruthy();
});
it('hides cached schedule and controls after access failure', () => {
  state.failed = true; show();
  expect(screen.getByRole('status').textContent).toContain('无权访问该合同');
  expect(screen.queryByText('待付')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});
it('does not offer generation while loading', () => {
  state.loading = true; show();
  expect(screen.getByRole('status').textContent).toContain('加载');
  expect(screen.queryByRole('button')).toBeNull();
});
it('shows failed milestone operations', () => {
  state.mutationFailed = true; show();
  expect(screen.getByRole('status').textContent).toContain('合同未生效');
});
it('keeps the school POC context when opening the payment ledger', () => {
  window.history.replaceState(null, '', '/?solution=ludong-poc&module=contracts');
  show();
  expect(screen.getByRole('link', { name: '付款台账' })).toHaveAttribute('href', '?solution=ludong-poc&module=invoices');
});
