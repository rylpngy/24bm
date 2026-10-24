import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProcurementExecutionPanel } from './procurement-execution-panel';

const s = vi.hoisted(() => ({ allowed: true, data: undefined as unknown, error: false, create: vi.fn(), download: vi.fn(), refresh: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ downloadReport: s.download }));
vi.mock('@24bid/api-client/procurement-execution', () => ({
  useProcurementExecution: () => ({ data: { data: s.data }, isPending: false, isError: s.error, isFetching: false, refetch: s.refresh }),
  createProcurementArchive: s.create,
}));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => s.allowed }) }));
const snapshot = { rfqId: 'r/1', title: '采购', status: '已定标', documents: [{ id: 'i/1', label: '发票001', status: '部分付款', amount: 100, module: 'invoices', recordId: 'i/1' }], budgetAmount: 100, orderAmount: 100, invoicedAmount: 100, paidAmount: 40, remainingAmount: 60, blockers: ['尚有60元未付'], canArchive: false, archives: [] };
beforeEach(() => { s.allowed = true; s.error = false; s.data = snapshot; s.create.mockReset().mockResolvedValue({ data: {} }); s.download.mockReset().mockResolvedValue(undefined); s.refresh.mockReset(); });
afterEach(cleanup);

it('shows real settlement blockers and record-specific navigation instead of claiming receipt equals archive', () => {
  render(<ProcurementExecutionPanel rfqId="r/1" />);
  expect(screen.getByText('尚有60元未付')).toBeTruthy();
  expect(screen.getByRole('button', { name: '生成归档快照' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('link', { name: '发票001' }).getAttribute('href')).toBe('?module=invoices&recordId=i%2F1');
  expect(screen.queryByText('已归档')).toBeNull();
});

it('requires an archive remark and refreshes after successful creation', async () => {
  s.data = { ...snapshot, blockers: [], canArchive: true, paidAmount: 100, remainingAmount: 0 };
  render(<ProcurementExecutionPanel rfqId="r/1" />);
  const button = screen.getByRole('button', { name: '生成归档快照' });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('归档说明'), { target: { value: '核对无误' } }); fireEvent.click(button);
  await waitFor(() => expect(s.create).toHaveBeenCalledWith('r/1', '核对无误'));
  expect(await screen.findByText('归档快照已生成。')).toBeTruthy(); expect(s.refresh).toHaveBeenCalled();
});

it('labels a stale archive and retains the captured download without claiming current completion', async () => {
  s.data = { ...snapshot, archives: [{ id: 'a/1', createdAt: '2001-01-01T00:00:00Z', createdBy: 'u1', sha256: 'hash', stale: true }] };
  render(<ProcurementExecutionPanel rfqId="r/1" />); expect(screen.getByText('历史快照 · 当前数据已变化')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '下载归档包' }));
  await waitFor(() => expect(s.download).toHaveBeenCalledWith('/api/v1/buyer/rfqs/r%2F1/execution/archives/a%2F1/download', '采购项目归档.zip'));
});

it('does not expose stale totals after a failed query or query data without required permissions', () => {
  s.error = true; const view = render(<ProcurementExecutionPanel rfqId="r/1" />);
  expect(screen.getByText('执行台账加载失败，请刷新后重试。')).toBeTruthy(); expect(screen.queryByText('发票001')).toBeNull();
  view.unmount(); s.error = false; s.allowed = false; render(<ProcurementExecutionPanel rfqId="r/1" />);
  expect(screen.getByText('查看完整执行台账需具备需求、询比、订单、合同、收货、财务及流程读取权限。')).toBeTruthy(); expect(screen.queryByText('发票001')).toBeNull();
});
