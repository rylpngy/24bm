import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierPerformanceTasks } from './supplier-performance-tasks';

const mocks = vi.hoisted(() => ({ manage: true, read: true, userId: 'assignee', status: 'assigned', version: 3,
  create: vi.fn(), evaluate: vi.fn(), request: vi.fn(), review: vi.fn(), list: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (p: string) => p.endsWith(':manage') ? mocks.manage : mocks.read }) }));
vi.mock('../../lib/auth-store', () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ session: { userId: mocks.userId } }) }));
vi.mock('@24bid/api-client', () => ({
  usePerformanceEvidence: () => ({ files: [], loading: false, busy: false, error: '', upload: vi.fn(), download: vi.fn(), refresh: vi.fn() }),
  listBuyerPerformanceTasks: mocks.list,
  listPerformanceAssignees: async () => ({ data: [{ id: 'assignee', displayName: '张评审' }] }),
  createPerformanceTask: mocks.create, evaluatePerformanceTask: mocks.evaluate,
  requestPerformanceRemediation: mocks.request, reviewPerformanceTask: mocks.review,
}));
afterEach(() => { cleanup(); focusManager.setFocused(undefined); vi.clearAllMocks(); mocks.manage = true; mocks.read = true; mocks.userId = 'assignee'; mocks.status = 'assigned'; mocks.version = 3; });
async function mount() {
  mocks.list.mockImplementation(async () => ({ data: [{ id: 'task-1', version: mocks.version, relationId: 'rel-1', period: '2026-Q4', assigneeId: 'assignee', assigneeName: '张评审', dueDate: '2026-12-31', status: mocks.status, history: [{ action: 'created', actorName: '管理员', comment: '任务已分派', createdAt: '2026-10-01' }] }] }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><SupplierPerformanceTasks relationId="rel-1" /></QueryClientProvider>);
  if (mocks.read) await screen.findByRole('button', { name: '查看任务' });
}
it('requires explicit assignee and due date for creation', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: '新建考核任务' }));
  expect(screen.getByLabelText('任务周期')).toHaveValue(`${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`);
  expect(screen.getByLabelText('考核截止日期')).toHaveValue('');
  expect(screen.getByRole('button', { name: '创建任务' })).toBeDisabled();
  await screen.findByRole('option', { name: '张评审' });
  fireEvent.change(screen.getByLabelText('考核人'), { target: { value: 'assignee' } });
  fireEvent.change(screen.getByLabelText('考核截止日期'), { target: { value: '2026-12-31' } });
  expect(screen.getByRole('button', { name: '创建任务' })).toBeEnabled();
});
it('does not let an owner evaluate another assignee task', async () => {
  mocks.userId = 'owner'; await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  expect(screen.queryByRole('button', { name: '提交任务考核' })).not.toBeInTheDocument();
  expect(screen.getByText('任务已分派')).toBeInTheDocument();
});
it('requires all four scores and evidence, retains failed drafts and prevents duplicate submits', async () => {
  mocks.evaluate.mockRejectedValue(new Error('offline'));
  await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  for (const name of ['质量评分', '交付评分', '价格评分', '服务评分']) {
    expect(screen.getByLabelText(name)).toHaveValue(null);
    fireEvent.change(screen.getByLabelText(name), { target: { value: '0' } });
  }
  expect(screen.getByRole('button', { name: '提交任务考核' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('任务考核依据'), { target: { value: '验收记录' } });
  const submit = screen.getByRole('button', { name: '提交任务考核' });
  fireEvent.click(submit); fireEvent.click(submit);
  await screen.findByRole('alert');
  expect(mocks.evaluate).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('任务考核依据')).toHaveValue('验收记录');
});
it.each(['evaluated', 'remediation_requested', 'remediation_submitted', 'closed'])('gates actions for %s', async status => {
  mocks.status = status; await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  expect(screen.queryByRole('button', { name: '提交任务考核' })).not.toBeInTheDocument();
  expect(!!screen.queryByRole('button', { name: '发起整改' })).toBe(status === 'evaluated');
  expect(!!screen.queryByRole('button', { name: '通过并关闭' })).toBe(status === 'remediation_submitted');
  if (status === 'evaluated') expect(screen.getByRole('button', { name: '发起整改' })).toBeDisabled();
  if (status === 'remediation_submitted') {
    expect(screen.getByRole('button', { name: '通过并关闭' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '退回整改' })).toBeDisabled();
  }
});
it('hides mutation controls for read-only users', async () => {
  mocks.manage = false; await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  expect(screen.queryByRole('button', { name: '新建考核任务' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '提交任务考核' })).not.toBeInTheDocument();
});
it('does not fetch tasks without read permission', async () => {
  mocks.read = false; await mount(); await waitFor(() => expect(mocks.list).not.toHaveBeenCalled());
});
it('refreshes an open task after the supplier responds', async () => {
  mocks.status = 'remediation_requested'; await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  mocks.status = 'remediation_submitted';
  fireEvent.click(screen.getByRole('button', { name: '刷新当前任务' }));
  expect(await screen.findByRole('button', { name: '通过并关闭' })).toBeInTheDocument();
});
it('requests remediation with explicit requirements and deadline then refreshes the task', async () => {
  mocks.status = 'evaluated';
  mocks.request.mockImplementation(async () => { mocks.status = 'remediation_requested'; mocks.version++; return { data: { id: 'task-1', version: mocks.version, status: 'remediation_requested' } }; });
  await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  fireEvent.change(screen.getByLabelText('整改要求'), { target: { value: '补齐验收记录' } });
  expect(screen.getByRole('button', { name: '发起整改' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('整改截止日期'), { target: { value: '2026-12-31' } });
  fireEvent.click(screen.getByRole('button', { name: '发起整改' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '发起整改' })).not.toBeInTheDocument());
  expect(mocks.request).toHaveBeenCalledWith('rel-1', 'task-1', { requirement: '补齐验收记录', dueDate: '2026-12-31' });
  expect(mocks.list.mock.calls.length).toBeGreaterThan(1);
});
it.each([true, false])('submits review approved=%s with required notes', async approved => {
  mocks.status = 'remediation_submitted';
  mocks.review.mockImplementation(async () => { mocks.status = approved ? 'closed' : 'remediation_requested'; mocks.version++; return { data: { id: 'task-1', version: mocks.version, status: mocks.status } }; });
  await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  fireEvent.change(screen.getByLabelText('复核意见'), { target: { value: '  复核记录  ' } });
  fireEvent.click(screen.getByRole('button', { name: approved ? '通过并关闭' : '退回整改' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '通过并关闭' })).not.toBeInTheDocument());
  expect(mocks.review).toHaveBeenCalledWith('rel-1', 'task-1', { approved, comment: '复核记录', expectedVersion: 3 });
  expect(await within(screen.getByRole('dialog', { name: '考核任务详情' })).findByText('操作已保存。')).toBeInTheDocument();
});
it('sends the displayed review version and retains notes on a stale-version conflict', async () => {
  mocks.status = 'remediation_submitted'; mocks.version = 7;
  mocks.review.mockRejectedValue({ response: { status: 409, data: { message: '任务版本已更新，请刷新后重试。' } } });
  await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  fireEvent.change(screen.getByLabelText('复核意见'), { target: { value: '本轮复核意见' } });
  fireEvent.click(screen.getByRole('button', { name: '通过并关闭' }));
  await screen.findByText('任务版本已更新，请刷新后重试。');
  expect(mocks.review).toHaveBeenCalledExactlyOnceWith('rel-1', 'task-1', { approved: true, comment: '本轮复核意见', expectedVersion: 7 });
  expect(screen.getByLabelText('复核意见')).toHaveValue('本轮复核意见');
});
it('keeps a successful action unavailable when the refresh fails', async () => {
  mocks.status = 'remediation_submitted';
  mocks.review.mockImplementation(async () => {
    mocks.list.mockRejectedValue(new Error('refresh offline'));
    return { data: { id: 'task-1', version: mocks.version + 1, status: 'closed' } };
  });
  await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  fireEvent.change(screen.getByLabelText('复核意见'), { target: { value: '整改完成' } });
  fireEvent.click(screen.getByRole('button', { name: '通过并关闭' }));
  await screen.findByText('考核任务加载失败。');
  expect(within(screen.getByRole('dialog', { name: '考核任务详情' })).getByText('任务刷新失败，请重试。')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '通过并关闭' })).not.toBeInTheDocument();
  expect(screen.getByText('已关闭')).toBeInTheDocument();
});
it('does not rebase an old review draft onto a newer round on window focus', async () => {
  mocks.status = 'remediation_submitted'; await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  const field = screen.getByLabelText('复核意见');
  fireEvent.change(field, { target: { value: '上一轮意见' } }); field.focus();
  mocks.version += 2;
  act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
  await screen.findByText('任务已更新，草稿已保留，请重新打开任务后提交。');
  expect(screen.getByLabelText('复核意见')).toBe(field); expect(field).toHaveValue('上一轮意见');
  expect(screen.getByRole('button', { name: '通过并关闭' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '退回整改' })).toBeDisabled();
  expect(mocks.review).not.toHaveBeenCalled();
});
it.each([
  ['assigned', '任务考核依据', '提交任务考核'],
  ['evaluated', '整改要求', '发起整改'],
  ['remediation_submitted', '复核意见', '通过并关闭'],
])('keeps the %s form and focus mounted while refetching', async (status, label, button) => {
  mocks.status = status; await mount(); fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value: '未提交草稿' } }); field.focus();
  let reject!: (error: Error) => void;
  mocks.list.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
  await waitFor(() => expect(screen.getByRole('button', { name: '刷新当前任务' })).toBeDisabled());
  expect(screen.getByLabelText(label)).toBe(field);
  expect(field).toHaveFocus(); expect(field).toHaveValue('未提交草稿');
  expect(screen.getByRole('button', { name: button })).toBeDisabled();
  await act(async () => reject(new Error('offline')));
  await screen.findByText('任务刷新失败，请重试。');
  expect(screen.getByLabelText(label)).toBe(field);
  expect(field).toHaveValue('未提交草稿');
  expect(screen.getByRole('button', { name: button })).toBeDisabled();
});
