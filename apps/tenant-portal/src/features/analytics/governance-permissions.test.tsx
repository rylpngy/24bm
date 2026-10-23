import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { BudgetsPage } from '../budgets/budgets-page';
import { AuditPage } from '../audit/audit-page';
import { AnalyticsPage } from './analytics-page';

const state = vi.hoisted(() => ({ manage: false, export: false, error: false }));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({ can: (permission: string) => permission === 'buyer:budget:manage' ? state.manage : state.export }),
}));
vi.mock('@24bid/api-client', () => ({
  useBuyerBudgetBudgets: () => ({ isError: state.error, data: { data: [{ id: 'b', departmentName: 'Restricted budget', totalAmount: 9000 }] } }),
  useDepartmentList: () => ({ data: { data: [] } }),
  useBuyerBudgetUpsert: () => ({}),
  useAuditLogList: () => ({ isError: state.error, error: { response: { data: { message: '企业审计台账需要全部数据范围' } } }, data: { data: [{ id: 'a', targetId: 'Restricted audit record' }] } }),
  useBuyerAnalyticsProcurement: () => ({ isError: state.error, data: { data: { totalSpend: 9000, orderCount: 2, monthlySpend: [], supplierSpend: [], statusDistribution: [], categorySpend: [] } } }),
  downloadReport: vi.fn(),
}));
afterEach(() => { cleanup(); state.manage = false; state.export = false; state.error = false; });
const show = (page: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{page}</QueryClientProvider>);

it('shows budget data but no maintenance action to a read-only account', () => {
  show(<BudgetsPage />);
  expect(screen.getByText('Restricted budget')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '设置预算' })).toBeNull();
});

it('closes access to an open budget form when management permission is withdrawn', () => {
  state.manage = true;
  const view = show(<BudgetsPage />);
  fireEvent.click(screen.getByRole('button', { name: '设置预算' }));
  expect(screen.getByText('保存预算')).toBeTruthy();
  state.manage = false;
  view.rerender(<QueryClientProvider client={new QueryClient()}><BudgetsPage /></QueryClientProvider>);
  expect(screen.queryByText('保存预算')).toBeNull();
});

it('does not present a failed budget query as cached data or a zero balance', () => {
  state.error = true;
  show(<BudgetsPage />);
  expect(screen.queryByText('Restricted budget')).toBeNull();
  expect(screen.getByText(/预算数据加载失败/)).toBeTruthy();
  expect(screen.getAllByText('--')).toHaveLength(3);
});

it('explains audit denial and hides stale records instead of showing an empty-history message', () => {
  state.error = true;
  show(<AuditPage />);
  expect(screen.getByText('企业审计台账需要全部数据范围')).toBeTruthy();
  expect(screen.queryByText('Restricted audit record')).toBeNull();
  expect(screen.queryByText('暂无操作记录。')).toBeNull();
});

it('requires an export permission separately from viewing analytics', () => {
  const view = show(<AnalyticsPage />);
  expect(screen.queryByRole('button', { name: /导出/ })).toBeNull();
  state.export = true;
  view.rerender(<QueryClientProvider client={new QueryClient()}><AnalyticsPage /></QueryClientProvider>);
  expect(screen.getByRole('button', { name: /导出/ })).toBeTruthy();
});

it('hides cached analytics when its refresh is denied', () => {
  state.error = true;
  show(<AnalyticsPage />);
  expect(screen.getByText('采购分析加载失败')).toBeTruthy();
  expect(screen.queryByText('¥9,000')).toBeNull();
});
