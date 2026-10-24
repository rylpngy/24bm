import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { DemandDetail } from './demand-detail';

const state = vi.hoisted(() => ({ initiator: 'requester', user: 'requester', status: 'processing', post: vi.fn() }));
vi.mock('../../lib/auth-store', () => ({ useAuthStore: (selector: (value: unknown) => unknown) => selector({ session: { userId: state.user } }) }));
vi.mock('@24bid/api-client', () => ({
  useMaterialList: () => ({ data: { data: [] } }), usePurchaseDemandList: () => ({}),
  useAuditLogListTargetActions: () => ({ data: { data: [] } }), useWorkflowPurchaseDemandSubmit: () => ({}),
  useWorkflowBusinessHistory: () => ({ data: { data: { workflowInstanceId: 'wf-1', initiatorId: state.initiator, status: state.status } } }),
  axiosInstance: { post: state.post },
}));
vi.mock('./demand-create-form', () => ({ DemandCreateForm: () => null }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowStatusPanel: () => null }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: () => null }));

beforeEach(() => { state.initiator = 'requester'; state.user = 'requester'; state.status = 'processing'; state.post.mockReset().mockResolvedValue({}); });
function show() {
  render(<QueryClientProvider client={new QueryClient()}><DemandDetail demand={{ id: 'demand-1', title: '审批中需求', status: '审批中', lineItems: [] }} onBack={vi.fn()} /></QueryClientProvider>);
}

it('requires a reason confirmation and withdraws the exact workflow instance', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '撤回审批' }));
  expect((screen.getByRole('button', { name: '确认撤回' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('撤回原因'), { target: { value: '修改数量' } });
  fireEvent.click(screen.getByRole('button', { name: '确认撤回' }));
  await waitFor(() => expect(state.post).toHaveBeenCalledWith(
    '/api/v1/buyer/workflow/instances/wf-1/withdraw-purchase-demand', { reason: '修改数量' }));
});

it('does not offer withdrawal of another initiators instance', () => {
  state.user = 'other-user'; show();
  expect(screen.queryByRole('button', { name: '撤回审批' })).toBeNull();
});

it('does not offer withdrawal after the workflow has completed despite stale demand status', () => {
  state.status = 'approved'; show();
  expect(screen.queryByRole('button', { name: '撤回审批' })).toBeNull();
});
