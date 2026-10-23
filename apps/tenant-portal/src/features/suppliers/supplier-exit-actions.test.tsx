import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierExitActions } from './supplier-exit-actions';

const mocks = vi.hoisted(() => ({ risk: vi.fn(), submit: vi.fn(), can: true }));
vi.mock('@24bid/api-client', async importOriginal => ({ ...await importOriginal<object>(), buyerSupplierExitRisk: mocks.risk,
  getSupplierExitRisk: mocks.risk, supplierExitSubmitExit: mocks.submit,
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
const clear = { unreceivedOrderCount: 0, unpaidInvoiceCount: 0, unpaidInvoiceFaceAmount: 0,
  unarchivedContractCount: 0, openAfterSalesCount: 0, uninvoicedOrderCount: 0,
  paymentVerificationRequiredCount: 0, remainingInvoiceAmount: 0, blocked: false };
it('blocks submission when unsettled invoices exist', async () => {
  mocks.risk.mockResolvedValue({ data: { ...clear, unpaidInvoiceCount: 1, blocked: true } });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  expect(await screen.findByText(/未付清发票 1 张/)).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it('requires a reason before submitting the workflow', async () => {
  mocks.risk.mockResolvedValue({ data: clear });
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
it.each([
  ['unarchivedContractCount', '未归档合同 1 份'], ['openAfterSalesCount', '未结售后 1 笔'],
  ['uninvoicedOrderCount', '未足额开票订单 1 笔'], ['paymentVerificationRequiredCount', '付款待核验 1 笔'],
])('blocks and displays %s even when the old counters are clear', async (field, label) => {
  mocks.risk.mockResolvedValue({ data: { ...clear, [field]: 1, blocked: true } });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  await screen.findByText(label);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it.each(Object.keys(clear))('fails closed when %s is missing', async field => {
  const response: Record<string, unknown> = { ...clear }; delete response[field];
  mocks.risk.mockResolvedValue({ data: response });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  await screen.findByText(/核查失败|核查数据不完整/);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it.each([
  { ...clear, blocked: true }, { ...clear, unarchivedContractCount: 1 },
  { ...clear, remainingInvoiceAmount: 12 }, { ...clear, unpaidInvoiceFaceAmount: 12 },
  { ...clear, blocked: 'false' }, { ...clear, openAfterSalesCount: -1 },
])('does not trust an inconsistent or invalid clearance response %#', async data => {
  mocks.risk.mockResolvedValue({ data }); mount();
  fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  await waitFor(() => expect(screen.queryByText('核查未结业务…')).toBeNull());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it('labels the amount as verified remaining invoices rather than total payables', async () => {
  mocks.risk.mockResolvedValue({ data: { ...clear, remainingInvoiceAmount: 125, blocked: true } });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  await screen.findByText(/已核验发票剩余金额/);
  expect(screen.getByText(/不含未开票及待核验金额，不代表全部应付款/)).toBeTruthy();
});
it('does not query clearance for viewers without supplier manage permission', () => {
  mocks.can = false; mount();
  expect(screen.queryByRole('button', { name: '申请退出' })).toBeNull();
  expect(mocks.risk).not.toHaveBeenCalled();
});
it('shows pending verification rather than an incomplete-response error for a valid unknown balance', async () => {
  mocks.risk.mockResolvedValue({ data: { ...clear, blocked: true, paymentVerificationRequiredCount: 2, remainingInvoiceAmount: null } });
  mount(); fireEvent.click(screen.getByRole('button', { name: '申请退出' }));
  await screen.findByText('已核验发票剩余金额：待核对');
  expect(screen.getByText('付款待核验 2 笔')).toBeTruthy();
  expect(screen.queryByText(/核查数据不完整/)).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
});
