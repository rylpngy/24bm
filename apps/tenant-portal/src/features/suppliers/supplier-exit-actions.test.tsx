import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierExitActions } from './supplier-exit-actions';

const mocks = vi.hoisted(() => ({ risk: vi.fn(), submit: vi.fn(), can: true }));
vi.mock('@24bid/api-client', () => ({ buyerSupplierExitRisk: mocks.risk, supplierExitSubmitExit: mocks.submit,
  useWorkflowRuntimeTasks: () => ({ data: { data: [] } }) }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => mocks.can }) }));
vi.mock('./supplier-admission-review-dialog', () => ({ SupplierAdmissionReviewDialog: () => null }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: ({ children, onSubmit }: { children: React.ReactNode; onSubmit: (value: Record<string, unknown>) => void }) =>
  <div role="dialog">{children}<button onClick={() => onSubmit({})}>确认提交</button></div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.can = true; });
function mount(status = '已准入') {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <SupplierExitActions id="rel" status={status} /></QueryClientProvider>);
}
it('blocks submission when unsettled invoices exist', async () => {
  mocks.risk.mockResolvedValue({ data: { unreceivedOrderCount: 0, unpaidInvoiceCount: 1 } });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  expect(await screen.findByText(/未付清发票 1 张/)).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it('requires a reason before submitting the workflow', async () => {
  mocks.risk.mockResolvedValue({ data: { unreceivedOrderCount: 0, unpaidInvoiceCount: 0 } });
  mocks.submit.mockResolvedValue({ data: {} });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  expect(mocks.submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('退出原因'), { target: { value: '合作结束' } });
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith('rel', { reason: '合作结束', formData: {} }));
});
it('hides submission for read-only users and does not offer review to non-assignees', () => {
  mocks.can = false; mount('退出审批中');
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText(/退出审批中，暂停新增订单/)).toBeTruthy();
});
