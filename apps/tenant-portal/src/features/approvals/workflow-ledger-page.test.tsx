import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLedgerPage } from './workflow-ledger-page';

const state = vi.hoisted(() => ({ calls: vi.fn(), mutate: vi.fn(), error: false, total: 241, historyError: false, historyStatus: 'approved' }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowInstancePanel: () => <div>流程资料</div> }));
vi.mock('@24bid/api-client', () => ({
  useWorkflowInstancesLedgerPage: (view: string, page: number, pageSize: number, keyword: string) => {
    state.calls(view, page, pageSize, keyword);
    return { data: { data: { total: state.total, items: [{ workflowInstanceId: 'instance', businessType: 'purchase_demand',
      businessId: `business-${page}`, status: 'approved', initiatorId: 'user', currentTask: { taskId: 'task' } }] } },
    isError: state.error, isLoading: false, isFetching: false, refetch: vi.fn() };
  },
  useUnifiedWorkflowInstanceHistory: () => ({ isLoading: false, isError: state.historyError,
    data: { data: { status: state.historyStatus, currentTask: { taskId: 'task' } } } }),
  useUnifiedWorkflowCompleteTask: () => ({ mutate: state.mutate, isPending: false }),
}));
afterEach(cleanup);
beforeEach(() => { state.calls.mockClear(); state.mutate.mockClear(); state.total = 241; state.error = false; state.historyError = false; state.historyStatus = 'approved'; });

describe('global workflow ledger pagination', () => {
  it('uses real totals and preserves page after returning from details', () => {
    render(<WorkflowLedgerPage />);
    expect(screen.getByText('共 241 条 · 1-20')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(state.calls).toHaveBeenLastCalledWith('pending', 2, 20, '');
    fireEvent.click(screen.getByRole('button', { name: '办理' }));
    expect(screen.getByText('流程资料')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '通过' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '返回台账' }));
    expect(screen.getByText('business-2')).toBeTruthy();
  });
  it('submits server search and resets page on search, view and size changes', () => {
    render(<WorkflowLedgerPage />);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索流程台账' }), { target: { value: ' older ' } });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(state.calls).toHaveBeenLastCalledWith('pending', 1, 20, 'older');
    fireEvent.click(screen.getByRole('button', { name: '全部实例' }));
    expect(state.calls).toHaveBeenLastCalledWith('all', 1, 20, '');
    fireEvent.change(screen.getByRole('combobox', { name: '每页条数' }), { target: { value: '50' } });
    expect(state.calls).toHaveBeenLastCalledWith('all', 1, 50, '');
  });
  it('does not expose cached rows when page load fails', () => {
    state.error = true;
    render(<WorkflowLedgerPage />);
    expect(screen.getByText('流程台账加载失败。')).toBeTruthy();
    expect(screen.queryByText('business-1')).toBeNull();
  });
  it('returns to the last valid page when the current page shrinks', () => {
    const view = render(<WorkflowLedgerPage />);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    state.total = 20;
    view.rerender(<WorkflowLedgerPage />);
    expect(state.calls).toHaveBeenLastCalledWith('pending', 1, 20, '');
  });
  it('hides action buttons when fresh history fails despite cached processing history', () => {
    state.historyError = true;
    state.historyStatus = 'processing';
    render(<WorkflowLedgerPage />);
    fireEvent.click(screen.getByRole('button', { name: '办理' }));
    expect(screen.getByText('审批详情加载失败。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '通过' })).toBeNull();
  });
  it('allows handling the matching active task after history is loaded', () => {
    state.historyStatus = 'processing';
    render(<WorkflowLedgerPage />);
    fireEvent.click(screen.getByRole('button', { name: '办理' }));
    fireEvent.click(screen.getByRole('button', { name: '通过' }));
    expect(state.mutate).toHaveBeenCalledWith({ taskId: 'task', data: { action: 'approve', comment: '' } }, expect.any(Object));
  });
});
