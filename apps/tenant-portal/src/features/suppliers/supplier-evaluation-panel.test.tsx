import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierEvaluationPanel } from './supplier-evaluation-panel';

const mocks = vi.hoisted(() => ({ write: true, create: vi.fn(), confirm: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => mocks.write }) }));
vi.mock('@24bid/api-client', () => ({
  useSupplierEvaluationAutoScore: () => ({ data: { data: { hasData: false } } }),
  useSupplierFulfillmentFulfillmentMetrics: () => ({}),
  useSupplierEvaluationListEvaluations: () => ({ data: { data: [{ id: 'evaluation-1', period: '2026-Q2', totalScore: 95, suggestedTier: '优选' }] } }),
  useSupplierEvaluationCreateEvaluation: () => ({ mutate: mocks.create }),
  useSupplierEvaluationConfirmTier: () => ({ mutate: mocks.confirm }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.write = true; });
function mount() { render(<QueryClientProvider client={new QueryClient()}><SupplierEvaluationPanel relationId="relation-1" /></QueryClientProvider>); }
it('starts without scores and blocks an incomplete evaluation', () => {
  mount();
  expect((screen.getByLabelText('质量（权重 35%）') as HTMLInputElement).value).toBe('');
  expect((screen.getByRole('button', { name: '提交考核单' }) as HTMLButtonElement).disabled).toBe(true);
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
