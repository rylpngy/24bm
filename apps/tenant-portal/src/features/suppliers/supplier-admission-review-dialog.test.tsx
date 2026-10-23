import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierAdmissionReviewDialog } from './supplier-admission-review-dialog';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), isError: false, historyError: false, pending: false, currentTaskId: 'task-1' }));
vi.mock('@24bid/api-client', () => ({
  useUnifiedWorkflowCompleteTask: () => ({ mutate: mocks.mutate, isError: mocks.isError, isPending: mocks.pending }),
  useUnifiedWorkflowInstanceHistory: () => ({ isError: mocks.historyError, data: { data: {
    status: 'processing', currentTask: { taskId: mocks.currentTaskId },
  } } }),
}));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowInstancePanel: () => <div>申请资料快照</div> }));
vi.mock('./supplier-qualifications-tab', () => ({ SupplierQualificationsTab: () => <div>资质证照</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.isError = false; mocks.historyError = false; mocks.pending = false; mocks.currentTaskId = 'task-1'; });
function mount(approved = false) {
  const onComplete = vi.fn();
  const onClose = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><SupplierAdmissionReviewDialog approved={approved} onClose={onClose} onComplete={onComplete}
    task={{ taskId: 'task-1', workflowInstanceId: 'instance-1', businessId: 'rel-1', businessType: 'buyer_supplier_admission',
      taskName: '资质核验', taskDefinitionKey: 'review', candidateRoleIds: [], candidateUserIds: [] }} /></QueryClientProvider>);
  return { onComplete, onClose };
}
it('requires a real rejection reason and suppresses duplicate clicks', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: '确认驳回' }));
  expect(mocks.mutate).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('补充');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  请补充有效营业执照  ' } });
  fireEvent.click(screen.getByRole('button', { name: '确认驳回' }));
  fireEvent.click(screen.getByRole('button', { name: '确认驳回' }));
  expect(mocks.mutate).toHaveBeenCalledOnce();
  expect(mocks.mutate.mock.calls[0][0]).toEqual({ taskId: 'task-1', data: { action: 'reject', comment: '请补充有效营业执照' } });
});
it('does not claim final admission when only an intermediate node has completed', () => {
  const { onComplete } = mount(true);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '资质核验完成' } });
  fireEvent.click(screen.getByRole('button', { name: '确认通过' }));
  mocks.mutate.mock.calls[0][1].onSuccess({ data: { status: 'processing' } });
  expect(onComplete).toHaveBeenCalledWith('当前节点已完成，已转交下一办理人。');
});
it.each(['load failure', 'stale task'])('blocks submission for %s', reason => {
  mocks.historyError = reason === 'load failure';
  mocks.currentTaskId = reason === 'stale task' ? 'other-task' : 'task-1';
  mount(true);
  expect((screen.getByRole('button', { name: '确认通过' }) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps the entered opinion visible on failure', () => {
  mocks.isError = true;
  mount();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '需补件' } });
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('需补件');
  expect(screen.getByRole('alert').textContent).toContain('审核失败');
});
