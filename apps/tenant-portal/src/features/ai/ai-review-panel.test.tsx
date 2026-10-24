import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AiReviewPanel } from './ai-review-panel';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), feedback: vi.fn(), use: true }));
vi.mock('@24bid/api-client/ai-reviews', () => ({ listAiReviews: api.list, getAiReview: api.get, createAiReview: api.create, saveAiFeedback: api.feedback }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (point: string) => point !== 'buyer:ai:use' || api.use }) }));
const result = { runId: 'run-1', subjectType: 'demand', subjectId: 'd-1', sourceRevision: 'sha-one', createdAt: '2026-01-01T00:00:00Z', mode: 'rules', rulesetVersion: 'v1', summary: '请补充交付要求', findings: [{ id: 'f-1', severity: 'warning', title: '交付要求缺失', detail: '需人工补充', evidenceIds: ['e-1'] }], evidence: [{ id: 'e-1', kind: 'field', locator: 'demand.delivery', label: '交付要求', value: '空' }], limitations: ['未接入正式大模型'], feedback: [] };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AiReviewPanel subjectType="demand" subjectId="d-1" onClose={vi.fn()} /></QueryClientProvider>);
beforeEach(() => {
  api.use = true; api.list.mockReset().mockResolvedValue([]); api.get.mockReset().mockResolvedValue(result); api.create.mockReset().mockResolvedValue(result); api.feedback.mockReset().mockResolvedValue({});
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
});
afterEach(cleanup);

it('generates only by explicit action and displays evidence, limits and truthful rules mode', async () => {
  mount(); await screen.findByText('暂无评审记录，可评审当前业务数据。');
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重新评审当前数据' }));
  expect(await screen.findByText('交付要求缺失')).toBeTruthy();
  expect(screen.getByText('本地规则评审')).toBeTruthy();
  expect(screen.getByText(/demand.delivery/)).toBeTruthy();
  expect(screen.getByText('未接入正式大模型')).toBeTruthy();
  expect(api.create).toHaveBeenCalledWith('demand', 'd-1');
  expect(screen.queryByRole('button', { name: /通过审批/ })).toBeNull();
});

it('records adoption as feedback without changing business records', async () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: '重新评审当前数据' }));
  await screen.findByText('交付要求缺失');
  fireEvent.change(screen.getByLabelText('反馈说明'), { target: { value: '人工核对' } });
  fireEvent.click(screen.getByRole('button', { name: '采纳建议' }));
  await waitFor(() => expect(api.feedback).toHaveBeenCalledWith('run-1', { findingId: 'f-1', disposition: 'adopted', comment: '人工核对' }));
  expect(await screen.findByText('处理反馈已记录，未改变业务审批结果。')).toBeTruthy();
});

it('allows history reading without AI use permission and exposes history errors', async () => {
  api.use = false; api.list.mockRejectedValue(new Error('denied'));
  mount(); expect(await screen.findByText('评审历史加载失败，请重试。')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '重新评审当前数据' })).toBeNull();
  expect(api.create).not.toHaveBeenCalled();
});

it('does not retain a previous result when a selected historical run fails authorization', async () => {
  api.list.mockResolvedValue([result]); api.get.mockRejectedValue(new Error('denied'));
  mount(); fireEvent.click(screen.getByRole('button', { name: '重新评审当前数据' }));
  await screen.findByText('交付要求缺失');
  fireEvent.change(screen.getByLabelText('评审历史'), { target: { value: 'run-1' } });
  expect(await screen.findByText('评审操作失败，请检查权限或刷新后重试。')).toBeTruthy();
  expect(screen.queryByText('交付要求缺失')).toBeNull();
});

it('clears the previous feedback draft when selecting another run', async () => {
  const second = { ...result, runId: 'run-2', findings: [{ ...result.findings[0], id: 'f-2' }] };
  api.list.mockResolvedValue([result, second]); api.get.mockResolvedValue(second);
  mount(); fireEvent.click(screen.getByRole('button', { name: '重新评审当前数据' }));
  await screen.findByText('交付要求缺失');
  fireEvent.change(screen.getByLabelText('反馈说明'), { target: { value: '只属于第一份记录' } });
  await waitFor(() => expect(screen.getByLabelText('评审历史').querySelector('option[value="run-2"]')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('评审历史'), { target: { value: 'run-2' } });
  await waitFor(() => expect((screen.getByLabelText('反馈说明') as HTMLTextAreaElement).value).toBe(''));
  fireEvent.click(screen.getByRole('button', { name: '采纳建议' }));
  await waitFor(() => expect(api.feedback).toHaveBeenCalledWith('run-2', { findingId: 'f-2', disposition: 'adopted', comment: '' }));
});

it('shows policy clauses even when they are references rather than rule findings', async () => {
  api.create.mockResolvedValue({ ...result, evidence: [...result.evidence, { id: 'policy-1', kind: 'POLICY', locator: 'clause:budget', label: '企业采购制度 / 预算复核', value: '经费须落实后执行采购', policyVersion: 'procurement:3', sourceHash: 'policy-hash' }] });
  mount(); fireEvent.click(screen.getByRole('button', { name: '重新评审当前数据' }));
  expect(await screen.findByText('经费须落实后执行采购')).toBeTruthy();
  expect(screen.getByText(/procurement:3/)).toBeTruthy();
  expect(screen.getByText('制度参考依据（适用性由人工核对）')).toBeTruthy();
});
