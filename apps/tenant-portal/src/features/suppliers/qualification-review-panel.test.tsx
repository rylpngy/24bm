import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QualificationReviewPanel } from './qualification-review-panel';
const state = vi.hoisted(() => ({ manage: true, status: 'pending', attempt: true, candidate: true, historyError: false, complete: vi.fn(), start: vi.fn().mockResolvedValue({ id: 'a' }) }));
vi.mock('../../lib/auth-store', () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ session: { userId: 'author' } }) }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (p: string) => p.endsWith(':read') || state.manage }) }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowInstancePanel: () => <p>完整审批历史</p> }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: ({ children, onSubmit }: { children: React.ReactNode; onSubmit: (data: Record<string, unknown>) => void }) => <div role="dialog">{children}<button onClick={() => onSubmit({ basis: '原件对照' })}>确认提交</button></div> }));
vi.mock('@24bid/api-client', () => ({
  qualificationReviews: async () => [{ id: 1, relationId: 'r', qualificationId: 'new', previousId: 'old', supplierName: '供应商', qualificationType: '许可证', status: state.status, createdAt: '2026-10-23T01:00:00Z' }],
  qualificationAttempts: async () => ({ items: state.attempt ? [{ id: 'a', reviewId: 1, workflowInstanceId: 'w', status: 'processing', createdBy: 'author' }] : [], total: state.attempt ? 1 : 0 }),
  startQualificationWorkflow: state.start, cancelQualificationWorkflow: vi.fn(), downloadReport: vi.fn(),
  useWorkflowRuntimeTasks: () => ({ data: { data: state.candidate ? [{ taskId: 'task', workflowInstanceId: 'w' }] : [] } }),
  useUnifiedWorkflowInstanceHistory: () => ({ isError: state.historyError, data: { data: { status: 'processing', currentTask: { taskId: 'task' } } } }),
  useUnifiedWorkflowCompleteTask: () => ({ mutate: state.complete, isPending: false }),
}));
afterEach(cleanup);
beforeEach(() => { state.manage = true; state.status = 'pending'; state.attempt = true; state.candidate = true; state.historyError = false; vi.clearAllMocks(); });
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QualificationReviewPanel /></QueryClientProvider>);
const details = async () => fireEvent.click(await screen.findByRole('button', { name: '详情' }));
it('requires an opinion and submits the real matching runtime task, not a direct review decision', async () => {
  show(); await details(); fireEvent.click(await screen.findByRole('button', { name: '退回补件' })); expect(state.complete).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('资质审核意见'), { target: { value: '请补充清晰原件' } }); fireEvent.click(screen.getByRole('button', { name: '退回补件' }));
  expect(state.complete).toHaveBeenCalledWith({ taskId: 'task', data: { action: 'reject', comment: '请补充清晰原件' } }, expect.any(Object));
});
it('does not show handling buttons when another candidate owns the task', async () => {
  state.candidate = false; show(); await details(); expect(await screen.findByText(/等待当前节点办理人/)).toBeTruthy(); expect(screen.queryByRole('button', { name: '通过本节点' })).toBeNull();
});
it('hides handling when workflow history fails, even with a cached task', async () => {
  state.historyError = true; show(); await details(); expect(await screen.findByText('流程详情加载失败或无权查看。')).toBeTruthy(); expect(screen.queryByRole('button', { name: '通过本节点' })).toBeNull();
});
it('read-only users can inspect originals and history but cannot mutate', async () => {
  state.manage = false; show(); await details(); expect(await screen.findByRole('button', { name: '新版原件' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '通过本节点' })).toBeNull(); expect(screen.queryByRole('button', { name: '取消本次流程' })).toBeNull();
});
it('collects a reason and published form before starting a qualification workflow', async () => {
  state.attempt = false; show(); await details(); fireEvent.click(await screen.findByRole('button', { name: '发起变更审批' }));
  fireEvent.click(screen.getByRole('button', { name: '确认提交' })); expect(state.start).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('变更审核依据'), { target: { value: '对照有效证照' } }); fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  await waitFor(() => expect(state.start).toHaveBeenCalledWith(1, '对照有效证照', { basis: '原件对照' }));
});
it('retains detail access for completed review records', async () => {
  state.status = 'approved'; show(); fireEvent.click(screen.getByRole('tab', { name: '审批记录' })); await details(); expect(await screen.findByText('完整审批历史')).toBeTruthy(); expect(screen.queryByRole('button', { name: '通过本节点' })).toBeNull();
});
