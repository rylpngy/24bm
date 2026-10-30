import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { fundingCents, ProjectFundingPanel } from './special-funding';

const state = vi.hoisted(() => ({ blocked: '', denied: false }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => true }) }));
vi.mock('@24bid/api-client', () => ({ useBudgetDepartments: () => ({ data: { data: [] } }) }));
vi.mock('@24bid/api-client/http-client', () => ({ customInstance: vi.fn(async ({ url }: { url: string }) => {
  if (state.denied) throw new Error('无权访问');
  return { data: url.endsWith('/changes') ? { items: [], total: 0 } : {
    enabled: false, blocker: state.blocked, sources: [],
    choices: [{ id: 'a', code: 'A', name: '专项资金 A' }, { id: 'b', code: 'B', name: '专项资金 B' }],
  } };
}) }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowStatusPanel: () => null }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: () => <div>资金审批确认</div> }));
beforeEach(() => { state.blocked = ''; state.denied = false; });
function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ProjectFundingPanel project={{ id: 'p', revision: 1, plannedAmount: 100, status: 'approved' }} />
  </QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: '资金分摊' }));
}
it('uses explicit two-decimal money rather than implicit source proportions', () => {
  expect(fundingCents('12.34')).toBe(1234);
  expect(fundingCents('12.345')).toBeNull();
  expect(fundingCents('-1')).toBeNull();
});
it('requires the full approved project amount and a reason before workflow submission', async () => {
  show();
  const edit = await screen.findByRole('button', { name: '编制分摊' });
  await vi.waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(edit);
  fireEvent.change(screen.getByLabelText('分摊资金来源 1'), { target: { value: 'a' } });
  fireEvent.change(screen.getByLabelText('分摊金额 1'), { target: { value: '90' } });
  fireEvent.change(screen.getByLabelText('分摊申请原因'), { target: { value: '专项资金分摊' } });
  expect((screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('分摊金额 1'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByText('资金审批确认')).toBeTruthy();
});
it('shows the actual business blocker and disables plan editing', async () => {
  state.blocked = '项目已有付款历史，不支持重新分摊或撤销分摊'; show();
  expect(await screen.findByText(state.blocked)).toBeTruthy();
  expect((screen.getByRole('button', { name: '编制分摊' }) as HTMLButtonElement).disabled).toBe(true);
});
