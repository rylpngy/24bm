import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkflowTaskOperations } from './workflow-task-operations';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function mount() {
  api.get.mockImplementation(async (path: string) => ({ data: { data: path.endsWith('/recipients')
    ? [{ id: 'reviewer-b', name: '审核乙', employeeNo: 'LDU200002' }] : { dueAt: null } } }));
  api.post.mockResolvedValue({ data: { data: null } });
  const transferred = vi.fn();
  const busy = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkflowTaskOperations taskId="task-1"
    onTransferred={transferred} onBusyChange={busy} /></QueryClientProvider>);
  return { transferred, busy };
}

it('requires a recipient and reason, then closes the stale task after a real transfer', async () => {
  const { transferred, busy } = mount();
  expect(screen.getByRole('button', { name: '确认转审' })).toBeDisabled();
  await screen.findByRole('option', { name: '审核乙 · LDU200002' });
  fireEvent.change(screen.getByLabelText('任务接收人'), { target: { value: 'reviewer-b' } });
  fireEvent.change(screen.getByLabelText('任务操作说明'), { target: { value: '专业审核转交' } });
  fireEvent.click(screen.getByRole('button', { name: '确认转审' }));
  await waitFor(() => expect(transferred).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/workflow/tasks/task-1/operations', {
    action: 'transfer', reason: '专业审核转交', recipientIds: ['reviewer-b'], dueAt: null,
  });
  expect(busy).toHaveBeenNthCalledWith(1, true);
  expect(busy).toHaveBeenLastCalledWith(false);
});

it('keeps errors inside the operation panel instead of silently closing the dialog', async () => {
  const { transferred } = mount();
  api.post.mockRejectedValue({ response: { data: { message: '当前用户无权办理该审批任务' } } });
  await screen.findByRole('option', { name: '审核乙 · LDU200002' });
  fireEvent.change(screen.getByLabelText('任务接收人'), { target: { value: 'reviewer-b' } });
  fireEvent.change(screen.getByLabelText('任务操作说明'), { target: { value: '转交' } });
  fireEvent.click(screen.getByRole('button', { name: '确认转审' }));
  expect(await screen.findByText('当前用户无权办理该审批任务')).toBeVisible();
  expect(transferred).not.toHaveBeenCalled();
});
