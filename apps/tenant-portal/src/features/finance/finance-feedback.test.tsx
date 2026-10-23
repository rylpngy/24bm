import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { financeErrorMessage } from './finance-feedback';
import { InvoicesPage } from './invoices-page';
import { ReconciliationVariancePanel } from './reconciliation-variance-panel';

const denied = vi.hoisted(() => ({
  isError: true,
  error: { response: { data: { message: '无权访问该发票及其付款数据' } } },
  data: { data: [{ id: 'hidden', invoiceNo: '不应显示的发票', invoiceId: 'hidden', matchStatus: '金额差异' }] },
}));
vi.mock('@24bid/api-client', () => ({
  useBuyerPaymentList: () => denied,
  useBuyerSupplierList: () => ({ data: { data: [] } }),
  useBuyerPaymentUpdate: () => ({}),
  useWorkflowPaymentRequestCreate: () => ({}),
  useBuyerFinanceActionThreeWayMatches: () => denied,
  useBuyerFinanceActionVarianceHandlings: () => denied,
  useBuyerFinanceActionCreateVarianceHandlingFromThreeWayMatch: () => ({}),
  useBuyerFinanceActionUpdateVarianceHandlingStatus: () => ({}),
  useBuyerFinanceActionApproveVarianceHandling: () => ({}),
}));

it('prefers the business error message and safely handles unexpected error values', () => {
  expect(financeErrorMessage({ message: 'HTTP 403', response: { data: { message: '数据范围不足' } } })).toBe('数据范围不足');
  expect(financeErrorMessage(new Error('连接失败'))).toBe('连接失败');
  expect(financeErrorMessage(null, '请重试')).toBe('请重试');
  expect(financeErrorMessage({ response: { data: { message: 123 } } }, '请重试')).toBe('请重试');
});

it('shows invoice permission errors instead of empty results or cached private data', () => {
  window.history.replaceState(null, '', '/?module=invoices&recordId=hidden');
  render(<QueryClientProvider client={new QueryClient()}><InvoicesPage /></QueryClientProvider>);
  expect(screen.getByRole('status').textContent).toContain('无权访问');
  expect(screen.queryByText('不应显示的发票')).toBeNull();
  expect(screen.queryByText('暂无发票')).toBeNull();
});

it('hides cached variance actions when the finance queries fail', () => {
  render(<QueryClientProvider client={new QueryClient()}><ReconciliationVariancePanel /></QueryClientProvider>);
  expect(screen.getByRole('status').textContent).toContain('无权访问');
  expect(screen.queryByText('登记差异处理')).toBeNull();
  expect(screen.queryByText('当前无未处理的金额差异。')).toBeNull();
});
