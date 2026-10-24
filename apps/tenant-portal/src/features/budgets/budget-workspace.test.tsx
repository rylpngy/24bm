import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetsPage } from './budgets-page';

const fixture = vi.hoisted(() => ({
  year: new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()),
  paid: null as number | null, manage: true, positionsError: false, requestsError: false,
  actor: 'author', status: 'draft', mutate: vi.fn(), approve: vi.fn(),
}));
const request = () => ({ id: 'request-1', departmentId: 'dept-a', period: fixture.year, kind: 'adjustment',
  targetAmount: 1200, baseAmount: 1000, baseVersion: 2, revision: 7, title: '设备年度预算调整', reason: '设备更新计划',
  status: fixture.status, createdBy: 'author', workflowInstanceId: fixture.status === 'draft' ? undefined : 'workflow-1' });
vi.mock('../../lib/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ session: { userId: fixture.actor } }) }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (point: string) => fixture.manage || point.endsWith(':read') }) }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowInstancePanel: () => <p>审批历史</p> }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: ({ onSubmit }: { onSubmit: (data: Record<string, unknown>) => void }) => <div role="dialog" aria-label="审批动态表单"><button onClick={() => onSubmit({ explanation: '动态表单依据' })}>确认提交</button></div> }));
vi.mock('@24bid/api-client', () => ({
  useBudgetPoolPositions: () => ({ isError: fixture.positionsError, data: { data: [{ departmentId: 'dept-a', departmentName: '部门A', period: fixture.year,
    totalAmount: 1000, version: 2, pending: 100, committed: 900, orderAmount: 900, paidAmount: fixture.paid, releasedAmount: 0 }] } }),
  useBudgetControlPolicy: () => ({ data: { data: { mode: 'warning', revision: 0, reason: '', unassignedOrderCount: 0, invalidDemandCount: 0, canConfigure: fixture.manage } } }),
  useBudgetDepartments: () => ({ data: { data: [{ id: 'dept-a', name: '部门A' }] } }),
  useBudgetChangeRequests: () => ({ isError: fixture.requestsError, data: { data: { items: [request()], total: 1 } } }),
  useBudgetChangeRequest: (id?: string) => ({ data: id ? { data: request() } : undefined }),
  useBudgetCommitments: () => ({ data: { data: { items: [], total: 0 } } }),
  useBudgetMissingOrders: () => ({ data: { data: { items: [], total: 0 } } }),
  useBudgetLifecycleMutation: () => ({ mutate: fixture.mutate, reset: vi.fn(), isPending: false }),
  useUnifiedWorkflowCompleteTask: () => ({ mutate: fixture.approve, reset: vi.fn(), isPending: false }),
  useWorkflowRuntimeTasks: () => ({ data: { data: [{ taskId: 'task-1', workflowInstanceId: 'workflow-1' }] } }),
  useUnifiedWorkflowInstanceHistory: () => ({ data: { data: { status: 'processing', currentTask: { taskId: 'task-1' } } } }),
}));
afterEach(cleanup);
beforeEach(() => {
  window.history.replaceState({}, '', '/?module=budgets');
  fixture.paid = null; fixture.manage = true; fixture.positionsError = false; fixture.requestsError = false;
  fixture.status = 'draft'; fixture.actor = 'author'; fixture.mutate.mockClear(); fixture.approve.mockClear();
});
function show() { return render(<QueryClientProvider client={new QueryClient()}><BudgetsPage /></QueryClientProvider>); }

describe('budget workspace', () => {
  it('defaults to warning and never saves a control policy just by opening the page', () => {
    show(); expect(screen.getByText('预警模式')).toBeTruthy(); expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it('shows unknown historical payments as unknown instead of inventing zero', () => {
    show(); expect(screen.getByText('待核对')).toBeTruthy(); expect(screen.getByText(/不能按零计算/)).toBeTruthy();
  });
  it('does not deduct payments a second time from the occupied amount', () => {
    fixture.paid = 900; show();
    const row = screen.getByRole('row', { name: /部门A/ });
    expect(within(row).getAllByText('¥900.00')).toHaveLength(2);
    expect(within(row).getAllByText('¥0.00')).toHaveLength(2);
  });
  it('keeps stale budget rows hidden when a read fails', () => {
    fixture.positionsError = true; show(); expect(screen.getByText('预算总览加载失败。')).toBeTruthy();
    expect(screen.queryByRole('row', { name: /部门A/ })).toBeNull();
  });
  it('saves a draft with revision, without directly changing an effective budget', () => {
    show(); fireEvent.click(screen.getByRole('button', { name: '预算申请' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑 设备年度预算调整' }));
    const dialog = screen.getByRole('dialog', { name: '编辑预算草稿' });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: '申请额度' }), { target: { value: '1500' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存草稿' }));
    expect(fixture.mutate).toHaveBeenCalledWith(expect.objectContaining({ action: 'edit', id: 'request-1', data: expect.objectContaining({ revision: 7, targetAmount: 1500 }) }), expect.any(Object));
  });
  it('collects published workflow fields before submitting a budget application', () => {
    show(); fireEvent.click(screen.getByRole('button', { name: '预算申请' }));
    fireEvent.click(screen.getByRole('button', { name: '提交 设备年度预算调整' }));
    fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
    expect(fixture.mutate).toHaveBeenCalledWith({ action: 'submit', id: 'request-1', data: { formData: { explanation: '动态表单依据' } } }, expect.any(Object));
  });
  it('requires explicit acknowledgement before enabling hard control', () => {
    show(); fireEvent.click(screen.getByRole('button', { name: '控制策略' }));
    fireEvent.click(screen.getByRole('radio', { name: '硬拦截' }));
    fireEvent.change(screen.getByRole('textbox', { name: '策略变更原因' }), { target: { value: '采购内控启用' } });
    fireEvent.click(screen.getByRole('button', { name: '保存策略' })); expect(fixture.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '保存策略' }));
    expect(fixture.mutate).toHaveBeenCalledWith({ action: 'policy', data: { mode: 'hard', revision: 0, reason: '采购内控启用', acknowledged: true } }, expect.any(Object));
  });
  it('does not expose handling controls to the author even if they also have approval permissions', () => {
    fixture.status = 'submitted'; show(); fireEvent.click(screen.getByRole('button', { name: '预算申请' }));
    fireEvent.click(screen.getByRole('button', { name: '详情' })); expect(screen.getByText('审批历史')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '通过' })).toBeNull();
  });
  it('allows the actual independent reviewer to complete the matching task', () => {
    fixture.status = 'submitted'; fixture.actor = 'reviewer'; show();
    fireEvent.click(screen.getByRole('button', { name: '预算申请' })); fireEvent.click(screen.getByRole('button', { name: '详情' }));
    fireEvent.click(screen.getByRole('button', { name: '通过' }));
    expect(fixture.approve).toHaveBeenCalledWith({ taskId: 'task-1', data: { action: 'approve', comment: '' } }, expect.any(Object));
  });
  it('keeps read-only users from creating or changing budgets', () => {
    fixture.manage = false; show(); expect(screen.queryByRole('button', { name: '新建预算申请' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '控制策略' })); expect(screen.queryByRole('button', { name: '保存策略' })).toBeNull();
  });
});
