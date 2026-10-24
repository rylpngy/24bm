import { expect, it, vi } from 'vitest';
import { customInstance } from './http-client';
import { createEvaluationTemplate, createEvaluationTemplateVersion, setEvaluationTemplateEnabled, listEvaluationTemplates, calculateEvaluationTotal, legacyScoring, validTemplateDraft, createPerformanceTask, evaluatePerformanceTask, listBuyerPerformanceTasks } from './supplier-evaluation-templates';
vi.mock('./http-client', () => ({ customInstance: vi.fn() }));
it('uses zero weights and rejects an invalid sum or nonfinite weights', () => {
  const draft = { name: '质量', qualityWeight: 100, deliveryWeight: 0, priceWeight: 0, serviceWeight: 0 };
  expect(validTemplateDraft(draft)).toBe(true);
  expect(validTemplateDraft({ ...draft, deliveryWeight: 1 })).toBe(false);
  expect(validTemplateDraft({ ...draft, qualityWeight: NaN })).toBe(false);
  expect(validTemplateDraft({ ...draft, qualityWeight: 99.99999999 })).toBe(false);
  expect(validTemplateDraft({ ...draft, name: ' ' })).toBe(false);
  expect(validTemplateDraft({ ...draft, name: 'x'.repeat(201) })).toBe(false);
  expect(calculateEvaluationTotal({ qualityScore: 80, deliveryScore: 0, priceScore: 0, serviceScore: 0 }, draft)).toBe(80);
  expect(legacyScoring.version).toBe(0);
});
it('sends version ids separately from template group ids', async () => {
  const body = { name: '质量', qualityWeight: 100, deliveryWeight: 0, priceWeight: 0, serviceWeight: 0 };
  await listEvaluationTemplates();
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v1/buyer/supplier-evaluation-templates', method: 'GET' }));
  await createEvaluationTemplate(body);
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'POST', data: body }));
  await createEvaluationTemplateVersion('group/1', body);
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v1/buyer/supplier-evaluation-templates/group%2F1/versions', data: body }));
  await setEvaluationTemplateEnabled('group/1', false);
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'PATCH', url: '/api/v1/buyer/supplier-evaluation-templates/group%2F1/enabled', data: { enabled: false } }));
});
it('creates tasks with a version id and evaluates against the already assigned snapshot', async () => {
  const draft = { period: '2026-Q4', assigneeId: 'assignee', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), templateVersionId: 'version-2' };
  await createPerformanceTask('relation/1', draft);
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/relation%2F1/performance-tasks', method: 'POST', data: draft }));
  const scores = { qualityScore: 80, deliveryScore: 0, priceScore: 0, serviceScore: 0, comment: '验收记录' };
  await evaluatePerformanceTask('relation/1', 'task/1', scores);
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/relation%2F1/performance-tasks/task%2F1/evaluate', method: 'POST', data: scores }));
  await listBuyerPerformanceTasks('relation/1');
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/relation%2F1/performance-tasks', method: 'GET' }));
});
