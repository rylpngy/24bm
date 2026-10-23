import { afterEach, expect, it, vi } from 'vitest';
import { customInstance } from './http-client';
import { createPerformanceTask, evaluatePerformanceTask, listBuyerPerformanceTasks, listPerformanceAssignees, listSupplierPerformanceTasks, requestPerformanceRemediation, respondPerformanceTask, reviewPerformanceTask } from './performance-tasks';

vi.mock('./http-client', () => ({ customInstance: vi.fn(async () => ({ data: [] })) }));
afterEach(() => vi.clearAllMocks());
it('lists buyer tasks and assignees with abort signals and envelope data', async () => {
  const signal = new AbortController().signal;
  expect(await listBuyerPerformanceTasks('rel/1', signal)).toEqual({ data: [] });
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/buyer/suppliers/rel%2F1/performance-tasks', method: 'GET', signal });
  await listPerformanceAssignees('rel/1', signal);
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/buyer/suppliers/rel%2F1/performance-assignees', method: 'GET', signal });
});
it('creates tasks using the explicit assignee and due date', async () => {
  const data = { period: '2027-Q1', assigneeId: 'user-1', dueDate: '2027-03-31' };
  await createPerformanceTask('rel-1', data);
  expect(customInstance).toHaveBeenCalledWith({ url: '/api/v1/buyer/suppliers/rel-1/performance-tasks', method: 'POST', headers: { 'Content-Type': 'application/json' }, data });
});
it('posts evaluation scores and notes unchanged, including zero', async () => {
  const data = { qualityScore: 0, deliveryScore: 25, priceScore: 50, serviceScore: 100, comment: '依据' };
  await evaluatePerformanceTask('rel-1', 'task/1', data);
  expect(customInstance).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/rel-1/performance-tasks/task%2F1/evaluate', method: 'POST', data }));
});
it('posts remediation requirements and due date', async () => {
  const data = { requirement: '补件', dueDate: '2027-04-30' };
  await requestPerformanceRemediation('rel-1', 'task-1', data);
  expect(customInstance).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/rel-1/performance-tasks/task-1/request-remediation', method: 'POST', data }));
});
it.each([true, false])('posts review approved=%s without changing its boolean', async approved => {
  const data = { approved, comment: '复核意见', expectedVersion: 7 };
  await reviewPerformanceTask('rel-1', 'task-1', data);
  expect(customInstance).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/buyer/suppliers/rel-1/performance-tasks/task-1/review', method: 'POST', data }));
});
it('uses only supplier-scoped endpoints for listing and responding', async () => {
  const signal = new AbortController().signal;
  await listSupplierPerformanceTasks(signal);
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/supplier/performance-tasks', method: 'GET', signal });
  await respondPerformanceTask('task-1', { response: '已整改', expectedVersion: 8 });
  expect(customInstance).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v1/supplier/performance-tasks/task-1/response', method: 'POST', data: { response: '已整改', expectedVersion: 8 } }));
});
