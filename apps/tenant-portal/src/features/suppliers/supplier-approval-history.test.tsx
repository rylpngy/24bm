import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SupplierApprovalHistory } from './supplier-approval-history';
const calls = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ useWorkflowBusinessInstances: (...args: unknown[]) => calls.list(...args), useUnifiedWorkflowInstanceHistory: (...args: unknown[]) => calls.detail(...args) }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowInstancePanel: ({ history }: { history: { workflowInstanceId: string } }) => <div>历史表单 {history.workflowInstanceId}</div> }));
describe('supplier approval attempts', () => {
  it('opens an exact historical instance and returns to its paginated list', () => {
    calls.list.mockImplementation((_type, _id, page) => ({ data: { data: { items: [{ workflowInstanceId: page === 1 ? 'rejected-old' : 'approved-new', status: page === 1 ? 'rejected' : 'approved', initiatorName: '发起人' }], total: 11 } } }));
    calls.detail.mockReturnValue({ data: { data: { workflowInstanceId: 'rejected-old' } } });
    render(<SupplierApprovalHistory businessId="relation" />);
    fireEvent.click(screen.getByRole('button', { name: '详情' }));
    expect(calls.detail).toHaveBeenCalledWith('rejected-old');
    expect(screen.getByText('历史表单 rejected-old')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回审批列表' }));
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(calls.list).toHaveBeenLastCalledWith('buyer_supplier_admission', 'relation', 2);
    expect(screen.getByText('approved-new')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '退出审批' }));
    expect(calls.list).toHaveBeenLastCalledWith('buyer_supplier_exit', 'relation', 1);
  });
  it('shows explicit failure instead of displaying stale history', () => {
    calls.list.mockReturnValue({ isError: true, refetch: vi.fn(), data: { data: { items: [{ workflowInstanceId: 'stale' }], total: 1 } } });
    render(<SupplierApprovalHistory businessId="relation" />);
    expect(screen.getByText('审批历史加载失败，请重试。')).toBeInTheDocument();
    expect(screen.queryByText('stale')).not.toBeInTheDocument();
  });
});
