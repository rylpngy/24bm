import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AdditionalReviewDecision } from './additional-review-panel';
import { WorkflowApplicationWithdrawal } from './workflow-application-withdrawal';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ axiosInstance: api }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function mount(view: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{view}</QueryClientProvider>);
}

it('requires an additional opinion and submits the exact pending review instead of main approval', async () => {
  api.get.mockResolvedValue({ data: { data: { id: 'review-2', requesterName: '原办理人', reviewerName: '专家乙', reason: '核对参数' } } });
  api.post.mockResolvedValue({ data: { data: null } });
  const done = vi.fn();
  mount(<AdditionalReviewDecision taskId="task-1" onDone={done} onBusyChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: '加审同意' })).toBeDisabled();
  await screen.findByText('加审说明：核对参数');
  fireEvent.change(screen.getByLabelText('加审意见'), { target: { value: '参数仍需补充' } });
  fireEvent.click(screen.getByRole('button', { name: '加审不同意' }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/workflow/tasks/task-1/additional-decision', {
    reviewId: 'review-2', action: 'reject', comment: '参数仍需补充',
  });
});

it('explains withdrawal and requires a reason before submitting', async () => {
  api.post.mockResolvedValue({ data: { data: null } });
  mount(<WorkflowApplicationWithdrawal instanceId="instance-1" />);
  fireEvent.click(screen.getByRole('button', { name: '撤回申报' }));
  expect(screen.getByRole('dialog', { name: '撤回采购申报' })).toBeVisible();
  expect(screen.getByText(/原审批记录保留/)).toBeVisible();
  expect(screen.getByRole('button', { name: '确认撤回' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('撤回原因'), { target: { value: '修订设备数量' } });
  fireEvent.click(screen.getByRole('button', { name: '确认撤回' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.post).toHaveBeenCalledWith('/api/v1/buyer/workflow/instances/instance-1/withdraw-ludong-application', { reason: '修订设备数量' });
});

it('keeps withdrawal errors visible without losing the entered reason', async () => {
  api.post.mockRejectedValue({ response: { data: { message: '审批状态已变化，请刷新' } } });
  mount(<WorkflowApplicationWithdrawal instanceId="instance-1" />);
  fireEvent.click(screen.getByRole('button', { name: '撤回申报' }));
  fireEvent.change(screen.getByLabelText('撤回原因'), { target: { value: '更正材料' } });
  fireEvent.click(screen.getByRole('button', { name: '确认撤回' }));
  expect(await screen.findByText('审批状态已变化，请刷新')).toBeVisible();
  expect(screen.getByLabelText('撤回原因')).toHaveValue('更正材料');
});
