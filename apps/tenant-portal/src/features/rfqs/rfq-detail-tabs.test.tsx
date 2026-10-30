import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { RfqProjectDetail } from './rfq-project-detail';
import { defaultRfqTab, RfqDetailTabs } from './rfq-detail-tabs';

const award = vi.hoisted(() => vi.fn());
vi.mock('@24bid/api-client', () => ({
  axiosInstance: { get: vi.fn().mockResolvedValue({ data: { data: null } }) },
  useRfqAbort: () => ({}), useRfqUpdate: () => ({}), useRfqAnnounceResult: () => ({}),
  useRfqOpen: () => ({}), useRfqRemind: () => ({}), useRfqStartNewRound: () => ({}),
  useRfqAcceptEnrollment: () => ({}), useRfqDismissEnrollment: () => ({}),
  useRfqListEnrollments: () => ({ data: { data: [] } }),
  useRfqListAnnouncements: () => ({ data: { data: [{ id: 'a', title: '询价公告样本', type: '采购公告' }] } }),
  useWorkflowRfqAwardSubmit: () => ({ mutate: award }),
}));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowStatusPanel: () => <p>定标审批进度样本</p> }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: ({ onSubmit }: { onSubmit: (form: object) => void }) => <button onClick={() => onSubmit({ opinion: '样本意见' })}>确认提交定标</button> }));
vi.mock('./rfq-clarifications', () => ({ RfqClarificationsBuyer: () => <p>澄清问题样本</p> }));
vi.mock('./rfq-result', () => ({ RfqResultBuyer: () => <p>结果公示样本</p> }));
vi.mock('./rfq-supplier-performance', () => ({ RfqSupplierPerformance: () => <p>供应商绩效样本</p> }));
vi.mock('./rfq-quotation-package', () => ({ RfqQuotationPackage: ({ view }: { view: string }) => <p>报价分类-{view}</p> }));
vi.mock('../quotes/bid-evaluation-panel', () => ({ BidEvaluationPanel: () => <p>综合评审样本</p> }));
vi.mock('./quote-comparison-table', () => ({ QuoteComparisonTable: ({ canAward, onAward }: { canAward: boolean; onAward: (id: string) => void }) => <button disabled={!canAward} onClick={() => onAward('q1')}>推荐报价样本</button> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function show(status: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RfqProjectDetail rfq={{ id: 'r1', title: '教学设备询比', method: '询比', status,
      deadlineAt: '2099-01-01T18:00:00+08:00', invitedSupplierIds: ['s1'],
      items: [{ demandItemId: 'item', materialName: '采集设备', quantity: 1, unit: '套' }],
      quotes: [{ id: 'q1', supplierId: 's1', amount: 100 }] }}
      budget={200} supplierNames={{ s1: '供应商甲' }} onBack={vi.fn()} />
  </QueryClientProvider>);
}

it('selects the current business stage by default', () => {
  expect(defaultRfqTab('草稿')).toBe('overview');
  expect(defaultRfqTab('报价中')).toBe('suppliers');
  expect(defaultRfqTab('已开标')).toBe('comparison');
  expect(defaultRfqTab('定标审批中')).toBe('result');
  expect(defaultRfqTab('已定标')).toBe('result');
});

it('shows only the selected category and preserves draft edits across tabs', () => {
  show('草稿');
  fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }));
  fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: '未保存的项目名称' } });
  fireEvent.click(screen.getByRole('tab', { name: '供应商参与' }));
  expect(screen.getByText('供应商参与进度')).toBeVisible();
  expect(screen.getByLabelText('项目名称')).not.toBeVisible();
  expect(screen.getByText('采购清单')).not.toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: '澄清公告' }));
  expect(screen.getByText('澄清问题样本')).toBeVisible();
  expect(screen.getByText('询价公告样本')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: '项目概览' }));
  expect(screen.getByLabelText('项目名称')).toHaveValue('未保存的项目名称');
});

it('preserves the award workflow submission rather than directly awarding', () => {
  show('已开标');
  expect(screen.getByRole('tab', { name: '比价定标' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('定标审批进度样本')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '推荐报价样本' }));
  expect(award).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认提交定标' }));
  expect(award).toHaveBeenCalledWith(expect.objectContaining({ rfqId: 'r1', quoteId: 'q1', formData: { opinion: '样本意见' } }), expect.anything());
});

it('keeps unawarded result pages informative and supports keyboard tab selection', () => {
  show('报价中');
  fireEvent.click(screen.getByRole('tab', { name: '审批与结果' }));
  expect(screen.getByText('定标审批进度样本')).toBeVisible();
  expect(screen.getByText(/尚未形成定标结果/)).toBeVisible();
  cleanup();
  const change = vi.fn();
  render(<RfqDetailTabs value="overview" onChange={change}>内容</RfqDetailTabs>);
  fireEvent.keyDown(screen.getByRole('tab', { name: '项目概览' }), { key: 'End' });
  expect(change).toHaveBeenCalledWith('result');
  expect(screen.getByRole('tab', { name: '审批与结果' })).toHaveFocus();
});
