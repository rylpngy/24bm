import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContractsPage } from './contracts-page';

const api = vi.hoisted(() => ({ submit: vi.fn(), canManage: true }));
vi.mock('@24bid/api-client', () => ({
  useBuyerContractList: () => ({ data: { data: [
    { id: 'c1', contractName: '教学设备合同', contractNo: 'HT-001', relatedOrderId: 'o1', amount: 100, status: '草案', paymentTerms: '验收后付款' },
    { id: 'c2', contractName: '实验设备合同', contractNo: 'HT-002', relatedOrderId: 'o2', amount: 200, status: '已生效' },
  ] } }),
  usePurchaseOrderList: () => ({ data: { data: [] } }),
  useBuyerContractCreate: () => ({}), useBuyerContractRenew: () => ({}),
  useBuyerContractReviewApproval: () => ({}), useBuyerContractUpdateArchiveStatus: () => ({}),
  useBuyerContractUpdateStatus: () => ({}), useWorkflowContractApprovalSubmit: () => ({ mutate: api.submit }),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => api.canManage }) }));
vi.mock('../attachments/owner-attachments', () => ({ OwnerAttachments: () => <p>合同原件附件样本</p> }));
vi.mock('./contract-esign-panel', () => ({ ContractEsignPanel: () => <p>签署核验样本</p> }));
vi.mock('./contract-amendments', () => ({ ContractAmendments: () => <p>合同变更历史样本</p> }));
vi.mock('./contract-schedule-section', () => ({ ContractScheduleSection: () => <p>付款计划样本</p> }));
vi.mock('./contract-payment-reconciliation-panel', () => ({ ContractPaymentReconciliationPanel: () => null, ContractReconciliationDetail: () => <p>付款对账样本</p> }));
vi.mock('./contract-fulfillment-events', () => ({ ContractFulfillmentEvents: () => {
  const [value, setValue] = useState('');
  return <input aria-label="履约登记摘要" value={value} onChange={(event) => setValue(event.target.value)} />;
} }));
vi.mock('./review/contract-review-workspace', () => ({ ContractReviewWorkspace: ({ embedded }: { embedded?: boolean }) => {
  const [value, setValue] = useState('');
  return <><p>{embedded ? '合同内嵌审查台账' : '独立审查台账'}</p><input aria-label="人工审查意见" value={value} onChange={(event) => setValue(event.target.value)} /></>;
} }));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowStatusPanel: () => <p>审批完整历史样本</p> }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: ({ onSubmit }: { onSubmit: (data: object) => void }) => <button onClick={() => onSubmit({ comment: '合同复核意见' })}>确认提交审批样本</button> }));

beforeEach(() => { api.canManage = true; window.history.replaceState(null, '', '/?module=contracts'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function show() {
  render(<QueryClientProvider client={new QueryClient()}><ContractsPage /></QueryClientProvider>);
  fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]);
}

it('keeps contract list columns compact without removing the approval and detail actions', () => {
  render(<QueryClientProvider client={new QueryClient()}><ContractsPage /></QueryClientProvider>);
  const table = screen.getByRole('table', { name: '采购合同列表' });
  expect(table).toHaveClass('table-fixed', 'whitespace-nowrap');
  expect(table.querySelectorAll('col')).toHaveLength(8);
  expect(within(table).getByTitle('教学设备合同')).toHaveClass('truncate');
  expect(within(table).getByTitle('HT-001')).toHaveClass('truncate');
  const action = within(table).getByRole('button', { name: '提交审批' });
  expect(action).toHaveClass('shrink-0', 'whitespace-nowrap');
  expect(action.closest('td')).toHaveClass('sticky', 'right-0');
  expect(within(table).getAllByRole('button', { name: '详情' })[0]).toHaveClass('w-14');
  fireEvent.click(action);
  expect(screen.getByText('合同条款')).toBeVisible();
  expect(api.submit).not.toHaveBeenCalled();
});

it('separates all seven categories without showing approvals and attachments on the basic page', () => {
  show();
  expect(screen.getByText('合同条款')).toBeVisible();
  expect(screen.queryByText('审批完整历史样本')).not.toBeInTheDocument();
  expect(screen.queryByText('合同原件附件样本')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '审批记录' }));
  expect(screen.getByText('审批完整历史样本')).toBeVisible();
  expect(screen.getByText('合同条款')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '附件与签署' }));
  expect(screen.getByText('合同原件附件样本')).toBeVisible();
  expect(screen.getByText('签署核验样本')).toBeVisible();
  expect(screen.getByText('审批完整历史样本')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '付款对账' }));
  expect(screen.getByText('付款对账样本')).toBeVisible();
  expect(screen.getByText('付款计划样本')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '合同变更' }));
  expect(screen.getByText('合同变更历史样本')).toBeVisible();
});

it('retains unsubmitted fulfillment and review input across category changes', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '履约记录' }));
  fireEvent.change(screen.getByLabelText('履约登记摘要'), { target: { value: '未提交的收货记录' } });
  fireEvent.click(screen.getByRole('button', { name: '智能审查' }));
  expect(screen.getByText('合同内嵌审查台账')).toBeVisible();
  expect(screen.getByText(/仅展示本合同关联的审查材料/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('人工审查意见'), { target: { value: '待确认意见' } });
  fireEvent.click(screen.getByRole('button', { name: '基本信息' }));
  fireEvent.click(screen.getByRole('button', { name: '履约记录' }));
  expect(screen.getByLabelText('履约登记摘要')).toHaveValue('未提交的收货记录');
  fireEvent.click(screen.getByRole('button', { name: '智能审查' }));
  expect(screen.getByLabelText('人工审查意见')).toHaveValue('待确认意见');
});

it('keeps the original approval submission payload and prevents read-only submission', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '提交审批' }));
  fireEvent.click(screen.getByRole('button', { name: '确认提交审批样本' }));
  expect(api.submit).toHaveBeenCalledWith({ contractId: 'c1', formData: { comment: '合同复核意见' } }, expect.anything());
  cleanup(); api.canManage = false; show();
  expect(screen.queryByRole('button', { name: '提交审批' })).not.toBeInTheDocument();
});

it('resets category and local drafts when opening a different contract', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '履约记录' }));
  fireEvent.change(screen.getByLabelText('履约登记摘要'), { target: { value: '第一份合同草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '返回合同台账' }));
  fireEvent.click(screen.getAllByRole('button', { name: '详情' })[1]);
  expect(screen.getByText('合同条款')).toBeVisible();
  expect(screen.queryByLabelText('履约登记摘要')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '履约记录' }));
  expect(screen.getByLabelText('履约登记摘要')).toHaveValue('');
});

it('allows returning to the ledger from a direct contract link and preserves the POC order link', async () => {
  window.history.replaceState(null, '', '/?solution=ludong-poc&module=contracts&recordId=c1');
  render(<QueryClientProvider client={new QueryClient()}><ContractsPage /></QueryClientProvider>);
  expect(await screen.findByText('合同条款')).toBeVisible();
  expect(screen.getByRole('link', { name: 'o1' })).toHaveAttribute('href', '?solution=ludong-poc&module=orders&recordId=o1');
  fireEvent.click(screen.getByRole('button', { name: '返回合同台账' }));
  expect(screen.getByText('合同管理')).toBeVisible();
  expect(window.location.search).not.toContain('recordId');
});
