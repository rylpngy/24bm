import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { PerformanceTasksPage } from './performance-tasks-page';
const mocks = vi.hoisted(() => ({ status: 'remediation_requested', version: 2, response: vi.fn(), list: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  listSupplierPerformanceTasks: mocks.list,
  respondPerformanceTask: mocks.response,
}));
afterEach(() => { cleanup(); focusManager.setFocused(undefined); vi.clearAllMocks(); mocks.status = 'remediation_requested'; mocks.version = 2; });
async function mount(canManage = true, count = 1) {
  mocks.list.mockImplementation(async () => ({ data: Array.from({ length: count }, (_, index) => ({ id: `task-${index + 1}`, version: mocks.version, buyerName: '采购企业甲', period: '2026-Q4', dueDate: '2026-12-31', status: mocks.status, requirement: '补充验收材料', assigneeName: '不展示的采购经办人', history: [{ action: 'remediation_rejected', actorName: '采购方', comment: '请补充材料', createdAt: '2026-10-01' }] })) }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PerformanceTasksPage canManage={canManage} /></QueryClientProvider>);
  fireEvent.click((await screen.findAllByRole('button', { name: '查看整改' }))[0]);
}
it('requires a response and retains it on failure', async () => {
  mocks.response.mockRejectedValue(new Error('offline')); await mount();
  expect(screen.getByRole('button', { name: '提交整改反馈' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('整改反馈内容'), { target: { value: '已补充验收材料' } });
  const button = screen.getByRole('button', { name: '提交整改反馈' }); fireEvent.click(button); fireEvent.click(button);
  await screen.findByRole('alert');
  expect(mocks.response).toHaveBeenCalledTimes(1);
  expect(mocks.response).toHaveBeenCalledWith('task-1', { response: '已补充验收材料', expectedVersion: 2 });
  expect(screen.getByLabelText('整改反馈内容')).toHaveValue('已补充验收材料');
  expect(screen.queryByText('不展示的采购经办人')).not.toBeInTheDocument();
});
it('sends the displayed response version and retains its draft on a conflict', async () => {
  mocks.version = 8;
  mocks.response.mockRejectedValue({ response: { status: 409, data: { message: '任务版本已更新，请刷新后重试。' } } });
  await mount();
  fireEvent.change(screen.getByLabelText('整改反馈内容'), { target: { value: '本轮整改反馈' } });
  fireEvent.click(screen.getByRole('button', { name: '提交整改反馈' }));
  await screen.findByText('任务版本已更新，请刷新后重试。');
  expect(mocks.response).toHaveBeenCalledExactlyOnceWith('task-1', { response: '本轮整改反馈', expectedVersion: 8 });
  expect(screen.getByLabelText('整改反馈内容')).toHaveValue('本轮整改反馈');
});
it.each(['assigned', 'evaluated', 'remediation_submitted', 'closed'])('does not allow response for %s', async status => {
  mocks.status = status; await mount(); expect(screen.queryByRole('button', { name: '提交整改反馈' })).not.toBeInTheDocument();
});
it('read-only users can inspect history but cannot respond', async () => {
  await mount(false); expect(screen.getByText('请补充材料')).toBeInTheDocument();
  expect(screen.queryByText('列表、详情和操作入口')).not.toBeInTheDocument();
  expect(screen.getByText(/采购方 · 退回整改/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '提交整改反馈' })).not.toBeInTheDocument();
});
it('refreshes the open task after rejection and allows a second response', async () => {
  mocks.status = 'remediation_submitted'; await mount();
  mocks.status = 'remediation_requested';
  fireEvent.click(screen.getByRole('button', { name: '刷新任务' }));
  expect(await screen.findByRole('button', { name: '提交整改反馈' })).toBeDisabled();
  expect(screen.getByLabelText('整改反馈内容')).toHaveValue('');
});
it('keeps the response field and focus mounted through a focus refetch', async () => {
  await mount();
  const field = screen.getByLabelText('整改反馈内容');
  fireEvent.change(field, { target: { value: '整改草稿' } }); field.focus();
  let reject!: (error: Error) => void;
  mocks.list.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
  await waitFor(() => expect(screen.getByRole('button', { name: '刷新任务' })).toBeDisabled());
  expect(screen.getByLabelText('整改反馈内容')).toBe(field); expect(field).toHaveFocus();
  expect(screen.getByRole('button', { name: '提交整改反馈' })).toBeDisabled();
  await act(async () => reject(new Error('offline')));
  await screen.findByText('整改任务加载失败。');
  expect(screen.getByLabelText('整改反馈内容')).toBe(field); expect(field).toHaveValue('整改草稿');
  expect(screen.getByRole('button', { name: '提交整改反馈' })).toBeDisabled();
});
it('blocks switching and collapsing a pending response and retains the failed draft', async () => {
  let reject!: (error: Error) => void;
  mocks.response.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  await mount(true, 2);
  fireEvent.change(screen.getByLabelText('整改反馈内容'), { target: { value: '待保存整改反馈' } });
  fireEvent.click(screen.getByRole('button', { name: '提交整改反馈' }));
  await waitFor(() => expect(mocks.response).toHaveBeenCalledTimes(1));
  const buttons = screen.getAllByRole('button', { name: '查看整改' });
  for (const button of buttons) { expect(button).toBeDisabled(); fireEvent.click(button); }
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  await act(async () => reject(new Error('offline')));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('整改反馈内容')).toHaveValue('待保存整改反馈');
  for (const button of buttons) expect(button).toBeEnabled();
  expect(screen.getByRole('button', { name: '提交整改反馈' })).toBeEnabled();
});
it('does not rebase an old response draft onto a newer round on window focus', async () => {
  await mount();
  const field = screen.getByLabelText('整改反馈内容');
  fireEvent.change(field, { target: { value: '上一轮整改内容' } }); field.focus();
  mocks.version += 2;
  act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
  await screen.findByText('任务已更新，草稿已保留，请重新打开任务后提交。');
  expect(screen.getByLabelText('整改反馈内容')).toBe(field); expect(field).toHaveValue('上一轮整改内容');
  expect(screen.getByRole('button', { name: '提交整改反馈' })).toBeDisabled();
  expect(mocks.response).not.toHaveBeenCalled();
});
