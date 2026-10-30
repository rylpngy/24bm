import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { DemandDetail } from './demand-detail';

const state = vi.hoisted(() => ({
  history: null as null | { workflowInstanceId: string; initiatorId: string; status: string },
}));
vi.mock('../../lib/auth-store', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ session: { userId: 'owner' } }) }));
vi.mock('@24bid/api-client', () => ({
  useSessionPermissions: () => ({ data: { data: { permissions: [] } } }),
  useMaterialList: () => ({ data: { data: [] } }),
  usePurchaseDemandList: () => ({}),
  useAuditLogListTargetActions: () => ({ data: { data: [{ id: 'audit-1', action: 'purchase_demand.direct_registered' }] } }),
  useWorkflowPurchaseDemandSubmit: () => ({}),
  useWorkflowBusinessHistory: () => ({ isLoading: false, isError: false, data: { data: state.history } }),
  axiosInstance: { post: vi.fn() },
}));
vi.mock('./demand-create-form', () => ({ DemandCreateForm: () => null }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: () => null }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowStatusPanel: () => <p>实际审批流程明细</p> }));

beforeEach(() => { state.history = null; });
function show(source = '直录登记') {
  render(<QueryClientProvider client={new QueryClient()}><DemandDetail demand={{
    id: 'direct-demand', title: '直录采购需求', source, status: '已通过', linkedRfqId: 'plan-1', lineItems: [],
  }} onBack={vi.fn()} /></QueryClientProvider>);
}

it('shows registration and plan linkage without inventing completed approvals for direct entry', () => {
  show();
  expect(screen.getByRole('heading', { name: '登记流转' })).toBeTruthy();
  expect(screen.getAllByText('关联采购计划')).toHaveLength(2);
  expect(screen.getByText('直录登记')).toBeTruthy();
  expect(screen.getByText(/系统业务状态为「已通过」以支持采购关联/)).toBeTruthy();
  expect(screen.queryByText('审批已完成')).toBeNull();
  expect(screen.queryByText('审批通过')).toBeNull();
  expect(screen.queryByText('提交审批')).toBeNull();
  expect(screen.queryByText('实际审批流程明细')).toBeNull();
});

it('does not infer completed approval steps from approved business status alone', () => {
  show('部门申报');
  expect(screen.getByText(/但未查询到统一审批流程记录/)).toBeTruthy();
  expect(screen.queryByText('审批已完成')).toBeNull();
  expect(screen.queryByText('提交审批')).toBeNull();
  expect(screen.getByText('暂无审批办理人记录')).toBeTruthy();
});

it('retains genuine completed workflow history even for a record marked as direct entry', () => {
  state.history = { workflowInstanceId: 'wf-1', initiatorId: 'owner', status: 'approved' };
  show();
  expect(screen.getByText('实际审批流程明细')).toBeTruthy();
  expect(screen.getByRole('heading', { name: '审批流转' })).toBeTruthy();
  expect(screen.getByText('审批已完成')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '登记流转' })).toBeNull();
});

it('uses actual running workflow state instead of claiming completion from a stale approved demand', () => {
  state.history = { workflowInstanceId: 'wf-1', initiatorId: 'owner', status: 'processing' };
  show('部门申报');
  expect(screen.queryByText('审批已完成')).toBeNull();
  expect(screen.queryByText('审批通过')).toBeNull();
  expect(screen.getByText('按审批节点角色办理')).toBeTruthy();
});
