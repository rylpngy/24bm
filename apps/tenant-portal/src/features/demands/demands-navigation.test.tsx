import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { DemandsPage } from './demands-page';

const fixtures = vi.hoisted(() => ({
  first: { data: { items: [{ id: 'demand-a', title: '测试需求', status: '已通过', budget: 100 }], total: 9 } },
  second: { data: { items: [{ id: 'demand-b', title: '第二页需求', status: '已通过', budget: 200 }], total: 9 } },
  detail: vi.fn(),
}));
vi.mock('@24bid/api-client', () => ({
  useDemandPage: ({ page }: { page: number }) => ({ data: page === 1 ? fixtures.first : fixtures.second }),
  useDemandDetail: fixtures.detail,
  useBuyerSupplierList: () => ({ data: { data: [] } }),
  useWorkflowPurchaseDemandSubmit: () => ({}),
  useRfqCreate: () => ({}),
}));
vi.mock('./demand-detail', () => ({
  DemandDetail: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>返回需求列表</button>,
}));
vi.mock('./demand-create-form', () => ({ DemandCreateForm: () => null }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: () => null }));

beforeEach(() => {
  window.history.replaceState(null, '', '/?module=demands&recordId=demand-outside-page');
  fixtures.detail.mockReturnValue({ data: { data: { id: 'demand-outside-page', title: '分页之外的需求' } } });
});

it('leaves a deep-linked demand detail without immediately reopening it', async () => {
  render(<QueryClientProvider client={new QueryClient()}><DemandsPage /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '返回需求列表' }));
  expect(fixtures.detail).toHaveBeenCalledWith('demand-outside-page');
  await waitFor(() => expect(screen.queryByRole('button', { name: '返回需求列表' })).toBeNull());
  expect(screen.getAllByText('测试需求').length).toBeGreaterThan(0);
  expect(new URLSearchParams(window.location.search).get('recordId')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('module')).toBe('demands');
});

it('retains selected records and their budgets when moving between server pages', async () => {
  window.history.replaceState(null, '', '/?module=demands');
  render(<QueryClientProvider client={new QueryClient()}><DemandsPage /></QueryClientProvider>);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getAllByText('第二页需求').length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  expect(screen.getByText('已选择 2 条采购需求，可合并生成采购计划')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '上一页' }));
  expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText('已选择 2 条采购需求，可合并生成采购计划')).toBeTruthy();
  expect(screen.getByText(/预算合计 ¥300.00/)).toBeTruthy();
});

it('does not display stale detail data after permission is revoked', () => {
  fixtures.detail.mockReturnValue({ data: { data: { title: '不得显示的内容' } }, isError: true });
  render(<QueryClientProvider client={new QueryClient()}><DemandsPage /></QueryClientProvider>);
  expect(screen.getByRole('alert').textContent).toContain('无访问权限');
  expect(screen.queryByText('不得显示的内容')).toBeNull();
});
