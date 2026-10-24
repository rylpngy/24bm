import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './analytics-page';
import { DashboardPage } from '../dashboard/dashboard-page';

const state = vi.hoisted(() => ({ denied: false, stale: false, zero: false, canRead: true, params: [] as unknown[], download: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (permission: string) => permission !== 'buyer:analytics:read' || state.canRead }) }));
vi.mock('../dashboard/buyer-notifications', () => ({ BuyerNotifications: () => null }));
vi.mock('recharts', () => {
  const Empty = () => null;
  return { Area: Empty, AreaChart: Empty, CartesianGrid: Empty, Cell: Empty, Pie: Empty, PieChart: Empty, ResponsiveContainer: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty };
});
vi.mock('@24bid/api-client', () => ({
  useBuyerAnalyticsProcurement: (params: { fromDate?: string; toDate?: string; supplierId?: string; status?: string }) => {
    state.params.push(params);
    const suppliers = [{ supplierId: 's', supplierName: 'Supplier' }, { supplierId: 'b', supplierName: 'Supplier B' }];
    return { isError: state.denied, isLoading: false, isFetching: false, isStale: state.stale, data: { data: {
      totalSpend: 123.45, orderCount: 1, supplierCount: 1, biddingSavings: 20,
      monthlySpend: [], supplierSpend: state.zero ? [] : suppliers.filter((supplier) => !params.supplierId || supplier.supplierId === params.supplierId), statusDistribution: [], categoryDemandEstimate: [], categorySpend: [],
      metadata: { appliedFilters: { fromDate: params.fromDate ?? '2026-01-01', toDate: params.toDate ?? '2026-12-31', supplierId: params.supplierId ?? 's', status: params.status ?? '已收货' }, definitionVersion: 'procurement-analytics-v2', createdAt: '2026-10-24T00:00:00Z', timezone: 'Asia/Shanghai', estimateBoundary: '需求估算独立口径' },
    } } };
  },
  useBuyerWorkspaceLoad: () => ({ isLoading: false, isError: false, data: { data: { orders: [{ amount: 999999 }], demands: [{ status: '已通过', budget: 1 }], suppliers: [], rfqs: [], invoices: [] } } }),
  downloadReport: state.download,
}));
afterEach(() => { cleanup(); state.denied = false; state.stale = false; state.zero = false; state.canRead = true; state.params = []; state.download.mockClear(); });

it('exports applied filters with a selectable format and uses honest monetary labels', async () => {
  render(<AnalyticsPage />);
  expect(screen.getByText('订单金额')).toBeTruthy();
  expect(screen.queryByText(/约占支出/)).toBeNull();
  fireEvent.change(screen.getByLabelText('导出格式'), { target: { value: 'pdf' } });
  fireEvent.click(screen.getByRole('button', { name: /导出报表/ }));
  await waitFor(() => expect(state.download).toHaveBeenCalled());
  const path = state.download.mock.calls[0][0] as string;
  expect(path).toContain('format=pdf');
  expect(path).toContain('fromDate=2026-01-01');
  expect(path).toContain('supplierId=s');
  expect(new URL(path, 'http://localhost').searchParams.get('status')).toBe('已收货');
});

it('applies date supplier and status filters to the query', () => {
  render(<AnalyticsPage />);
  fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-03-31' } });
  fireEvent.change(screen.getByLabelText('供应商'), { target: { value: 's' } });
  fireEvent.change(screen.getByLabelText('订单状态'), { target: { value: '已收货' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(state.params).toContainEqual({ fromDate: '2026-02-01', toDate: '2026-03-31', supplierId: 's', status: '已收货' });
});

it('submits the complete displayed range when only the end date is edited', () => {
  render(<AnalyticsPage />);
  expect(screen.getByLabelText('开始日期')).toHaveValue('2026-01-01');
  fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-03-31' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(state.params).toContainEqual({ fromDate: '2026-01-01', toDate: '2026-03-31' });
});

it('keeps authorized supplier B available after selecting supplier A', () => {
  render(<AnalyticsPage />);
  fireEvent.change(screen.getByLabelText('供应商'), { target: { value: 's' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(screen.getByRole('option', { name: 'Supplier B' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('供应商'), { target: { value: 'b' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(state.params).toContainEqual({ fromDate: '2026-01-01', toDate: '2026-12-31', supplierId: 'b' });
});

it('preserves the selected supplier even when a date or status produces zero rows', () => {
  const view = render(<AnalyticsPage />);
  fireEvent.change(screen.getByLabelText('供应商'), { target: { value: 's' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  state.zero = true;
  view.rerender(<AnalyticsPage />);
  expect(screen.getByLabelText('供应商')).toHaveValue('s');
});

it('dashboard uses backend year totals instead of workspace sums and removes invalid budget execution', () => {
  render(<DashboardPage onNavigate={() => {}} />);
  expect(screen.getByText('¥123.45')).toBeTruthy();
  expect(screen.queryByText(/预算执行率/)).toBeNull();
  expect(screen.queryByText(/999,999/)).toBeNull();
  expect(state.params[0]).toMatchObject({ fromDate: expect.stringMatching(/^\d{4}-01-01$/), toDate: expect.stringMatching(/^\d{4}-12-31$/) });
});

it('keeps the operational dashboard usable without analytics permission', () => {
  state.canRead = false;
  render(<DashboardPage onNavigate={() => {}} />);
  expect(screen.getByRole('button', { name: '进入审批中心' })).toBeTruthy();
  expect(screen.queryByText('本年度订单金额')).toBeNull();
});

it('does not show expired analytics as current statistics', () => {
  state.stale = true;
  render(<AnalyticsPage />);
  expect(screen.queryByText('订单金额')).toBeNull();
  expect(screen.getByText('正在加载采购分析')).toBeTruthy();
});

it('dashboard hides denied stale analytics instead of rendering them as success', () => {
  state.denied = true;
  render(<DashboardPage onNavigate={() => {}} />);
  expect(screen.getByText('采购统计加载失败')).toBeTruthy();
  expect(screen.queryByText('本年度订单金额')).toBeNull();
});
