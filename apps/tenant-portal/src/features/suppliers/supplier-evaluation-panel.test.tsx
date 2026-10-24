import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierEvaluationPanel } from './supplier-evaluation-panel';

const mocks = vi.hoisted(() => ({ write: true, create: vi.fn(), confirm: vi.fn(), metrics: vi.fn(), enabled: true, templateError: false }));
vi.mock('@24bid/api-client/supplier-evaluation-templates', async original => ({
  ...await original<object>(),
  useEvaluationTemplates: () => ({ isError: mocks.templateError, data: { data: [{ id: 'version-1', templateId: 'group-1', name: '质量优先', version: 2, qualityWeight: 100, deliveryWeight: 0, priceWeight: 0, serviceWeight: 0, enabled: mocks.enabled }] } }),
  useScoredSupplierEvaluations: () => ({ data: { data: [{ id: 'evaluation-1', period: '2026-Q2', totalScore: 95, suggestedTier: '优选', scoring: { templateVersionId: 'old', templateId: 'old-group', templateName: '历史模板', version: 1, qualityWeight: 0, deliveryWeight: 100, priceWeight: 0, serviceWeight: 0 } }] } }),
  useCreateScoredSupplierEvaluation: () => ({ mutate: mocks.create }),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => mocks.write }) }));
vi.mock('@24bid/api-client', () => ({
  useSupplierEvaluationAutoScore: () => ({ data: { data: { hasData: false } } }),
  useSupplierFulfillmentFulfillmentMetrics: () => ({}),
  getSupplierPeriodFulfillment: mocks.metrics,
  useSupplierEvaluationListEvaluations: () => ({ data: { data: [{ id: 'evaluation-1', period: '2026-Q2', totalScore: 95, suggestedTier: '优选' }] } }),
  useSupplierEvaluationCreateEvaluation: () => ({ mutate: mocks.create }),
  useSupplierEvaluationConfirmTier: () => ({ mutate: mocks.confirm }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.write = true; mocks.enabled = true; mocks.templateError = false; });
function mount() { render(<QueryClientProvider client={new QueryClient()}><SupplierEvaluationPanel relationId="relation-1" /></QueryClientProvider>); }
it('starts without scores and blocks an incomplete evaluation', () => {
  mount();
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe('');
  expect((screen.getByRole('button', { name: '提交考核单' }) as HTMLButtonElement).disabled).toBe(true);
});
it('uses selected period metrics only on explicit click and clears scores on period changes', async () => {
  mocks.metrics.mockImplementation(async (_id, period) => ({ data: { period, startDate: '2001-04-01', endDateExclusive: '2001-07-01', receiptCount: 2, scheduledReceiptCount: 1, totalReceived: 10, derivedQualityScore: 0, derivedDeliveryScore: 80 } }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SupplierEvaluationPanel relationId="relation-1" supplierId="supplier-1" /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2001-Q2' } });
  await screen.findByRole('button', { name: '回填质量/交付' });
  expect(screen.getByText(/2001-04-01 至 2001-07-01（结束日期不含）/)).toBeTruthy();
  await waitFor(() => expect((screen.getByRole('button', { name: '回填质量/交付' }) as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '回填质量/交付' }));
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe('0');
  mocks.metrics.mockReturnValue(new Promise(() => {}));
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2025-01' } });
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('button', { name: '回填质量/交付' })).toBeNull();
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2025-13' } });
  expect(mocks.metrics.mock.calls.some(call => call[1] === '2025-13')).toBe(false);
});
it.each(['empty', 'error', 'mismatch'])('never fills %s metrics', async mode => {
  if (mode === 'error') mocks.metrics.mockRejectedValue(new Error('failed'));
  else mocks.metrics.mockImplementation(async (_id, period) => ({ data: { period: mode === 'mismatch' ? '2020' : period, receiptCount: 0, scheduledReceiptCount: 0, totalReceived: 0, derivedQualityScore: 99, derivedDeliveryScore: 99 } }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SupplierEvaluationPanel relationId="relation-1" supplierId="supplier-1" /></QueryClientProvider>);
  await screen.findByText(mode === 'error' ? '履约参考加载失败，请重试。' : mode === 'mismatch' ? '履约参考周期不一致，请刷新。' : '所选周期暂无验收样本。');
  expect(screen.queryByRole('button', { name: '回填质量/交付' })).toBeNull();
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe('');
});
it.each(['quality', 'delivery'])('only fills %s when the other denominator is absent', async available => {
  mocks.metrics.mockImplementation(async (_id, period) => ({ data: {
    period, receiptCount: 2, scheduledReceiptCount: available === 'delivery' ? 1 : 0,
    totalReceived: available === 'quality' ? 10 : 0, totalQualified: 0,
    qualifiedRate: available === 'quality' ? 0 : null, onTimeRate: available === 'delivery' ? 0 : null,
    derivedQualityScore: available === 'quality' ? 0 : null, derivedDeliveryScore: available === 'delivery' ? 0 : null,
  } }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SupplierEvaluationPanel relationId="relation-1" supplierId="supplier-1" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '回填质量/交付' }));
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe(available === 'quality' ? '0' : '');
  expect((screen.getByLabelText('交付（权重 30%）') as HTMLInputElement).value).toBe(available === 'delivery' ? '0' : '');
  expect(screen.getByText('0%')).toBeTruthy();
});
it('hides cached fulfillment on failed refresh and offers retry', async () => {
  mocks.metrics.mockImplementation(async (_id, period) => ({ data: { period, receiptCount: 1, totalReceived: 1, scheduledReceiptCount: 1, derivedQualityScore: 80, derivedDeliveryScore: 90 } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SupplierEvaluationPanel relationId="relation-1" supplierId="supplier-1" /></QueryClientProvider>);
  await screen.findByRole('button', { name: '回填质量/交付' });
  mocks.metrics.mockRejectedValueOnce(new Error('failed'));
  await client.invalidateQueries();
  await screen.findByText('履约参考加载失败，请重试。');
  expect(screen.queryByRole('button', { name: '回填质量/交付' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试履约参考' }));
  await screen.findByRole('button', { name: '回填质量/交付' });
});
it('submits explicit zero scores with the entered evidence', () => {
  mount();
  for (const label of ['质量（权重 35%）', '交付（权重 30%）', '价格（权重 20%）', '服务（权重 15%）']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '0' } });
  }
  fireEvent.change(screen.getByLabelText('考核依据'), { target: { value: '合同履约记录与验收记录' } });
  fireEvent.click(screen.getByRole('button', { name: '提交考核单' }));
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ qualityScore: 0, serviceScore: 0, comment: '合同履约记录与验收记录' }) }), expect.anything());
});
it('uses a saved evaluation rather than draft scores for tier confirmation', () => {
  mount();
  expect((screen.getByRole('button', { name: '确认调级' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('调级依据'), { target: { value: 'evaluation-1' } });
  fireEvent.click(screen.getByRole('button', { name: '确认调级' }));
  expect(mocks.confirm).toHaveBeenCalledWith({ relationId: 'relation-1', data: { cooperationTier: '优选', evaluationScore: 95 } }, expect.anything());
});
it('disables both write actions for read-only users', () => {
  mocks.write = false; mount();
  expect((screen.getByRole('button', { name: '提交考核单' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '确认调级' }) as HTMLButtonElement).disabled).toBe(true);
});
it('blocks out-of-range scores and a previously recorded period', () => {
  mount();
  for (const label of ['质量（权重 35%）', '交付（权重 30%）', '价格（权重 20%）', '服务（权重 15%）']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '90' } });
  }
  fireEvent.change(screen.getByLabelText('考核依据'), { target: { value: '依据记录' } });
  fireEvent.change(screen.getByLabelText('质量（权重 35%）'), { target: { value: '101' } });
  expect((screen.getByRole('button', { name: '提交考核单' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('质量（权重 35%）'), { target: { value: '90' } });
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2026-Q2' } });
  expect(screen.getByRole('alert').textContent).toContain('已有考核单');
  expect((screen.getByRole('button', { name: '提交考核单' }) as HTMLButtonElement).disabled).toBe(true);
});
it('uses the selected version for live totals and submission while preserving historical scoring', () => {
  mount();
  fireEvent.change(screen.getByLabelText('考核模板'), { target: { value: 'version-1' } });
  for (const [label, score] of [['质量（权重 100%）', '80'], ['交付（权重 0%）', '0'], ['价格（权重 0%）', '0'], ['服务（权重 0%）', '0']]) fireEvent.change(screen.getByLabelText(label), { target: { value: score } });
  expect(screen.getByText('80.00')).toBeTruthy();
  expect(screen.getByText('历史模板 · v1 · 质量 0% / 交付 100% / 价格 0% / 服务 0%')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('考核依据'), { target: { value: '验收记录' } });
  fireEvent.click(screen.getByRole('button', { name: '提交考核单' }));
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ templateVersionId: 'version-1' }) }), expect.anything());
});
it('does not offer disabled templates or permit submission when template loading fails', () => {
  mocks.enabled = false; mocks.templateError = true; mount();
  expect(screen.queryByRole('option', { name: '质量优先 · v2' })).toBeNull();
  expect(screen.getByText('模板加载失败，暂不能提交。')).toBeTruthy();
  expect((screen.getByRole('button', { name: '提交考核单' }) as HTMLButtonElement).disabled).toBe(true);
});
