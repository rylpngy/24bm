import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { RfqProjectDetail } from './rfq-project-detail';

const api = vi.hoisted(() => ({ abort: vi.fn(), update: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useRfqAbort: () => ({ mutate: api.abort }), useRfqUpdate: () => ({ mutate: api.update }),
  useRfqAnnounceResult: () => ({}), useRfqOpen: () => ({}), useRfqRemind: () => ({}),
  useRfqStartNewRound: () => ({}), useRfqAcceptEnrollment: () => ({}), useRfqDismissEnrollment: () => ({}),
  useRfqListEnrollments: () => ({ data: { data: [] } }), useRfqListAnnouncements: () => ({ data: { data: [] } }),
  useWorkflowRfqAwardSubmit: () => ({}),
}));
vi.mock('../workflow/workflow-instance-panel', () => ({ WorkflowStatusPanel: () => null }));
vi.mock('../workflow/workflow-submit-dialog', () => ({ WorkflowSubmitDialog: () => null }));
vi.mock('./rfq-clarifications', () => ({ RfqClarificationsBuyer: () => null }));
vi.mock('./rfq-result', () => ({ RfqResultBuyer: () => null }));
vi.mock('./rfq-supplier-performance', () => ({ RfqSupplierPerformance: () => null }));

function show() {
  render(<QueryClientProvider client={new QueryClient()}><RfqProjectDetail
    rfq={{ id: 'rfq-1', title: '过期草稿', status: '草稿', deadlineAt: '2020-01-01T18:00:00+08:00', invitedSupplierIds: [] }}
    budget={100} supplierNames={{}} onBack={vi.fn()} /></QueryClientProvider>);
}

it('allows changing an expired draft deadline without publishing', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }));
  fireEvent.change(screen.getByLabelText('报价截止时间'), { target: { value: '2030-01-01T18:00' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  expect(api.update).toHaveBeenCalledWith(expect.objectContaining({ rfqId: 'rfq-1', data: expect.objectContaining({
    title: '过期草稿', invitedSupplierIds: [],
  }) }), expect.anything());
});

it('requires a reason before cancelling a persisted draft', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '取消草稿' }));
  expect((screen.getByRole('button', { name: '确认取消草稿' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('取消原因'), { target: { value: '重复建项' } });
  fireEvent.click(screen.getByRole('button', { name: '确认取消草稿' }));
  expect(api.abort).toHaveBeenCalledWith({ rfqId: 'rfq-1', data: { kind: '废标', reason: '重复建项' } }, expect.anything());
});

it('disables early opening for auctions but preserves compare early opening', () => {
  const props = { budget: 100, supplierNames: {}, onBack: vi.fn() };
  const rfq = { id: 'auction', title: '竞价', method: '竞价', status: '报价中',
    deadlineAt: '2099-01-01T18:00:00+08:00', invitedSupplierIds: [] };
  const view = render(<QueryClientProvider client={new QueryClient()}>
    <RfqProjectDetail {...props} rfq={rfq} />
  </QueryClientProvider>);
  expect(screen.getByRole('button', { name: '截止后开标' })).toBeDisabled();
  view.rerender(<QueryClientProvider client={new QueryClient()}>
    <RfqProjectDetail {...props} rfq={{ ...rfq, method: '询比' }} />
  </QueryClientProvider>);
  expect(screen.getByRole('button', { name: '提前截标开标' })).toBeEnabled();
});
