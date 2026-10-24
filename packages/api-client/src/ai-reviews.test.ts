import { beforeEach, expect, it, vi } from 'vitest';
import { createAiReview, getAiReview, listAiReviews, saveAiFeedback } from './ai-reviews';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./http-client', () => ({ axiosInstance: http }));
beforeEach(() => { http.get.mockReset().mockResolvedValue({ data: { data: [] } }); http.post.mockReset().mockResolvedValue({ data: { data: { runId: 'run-1' } } }); });
it('uses exact business subjects and never substitutes owner IDs for attachment IDs', async () => {
  await listAiReviews('attachment', 'attachment/one');
  expect(http.get).toHaveBeenCalledWith('/api/v1/buyer/ai/reviews', { params: { subjectType: 'attachment', subjectId: 'attachment/one' }, signal: undefined });
  await createAiReview('demand', 'd-1', 'revision-1');
  expect(http.post).toHaveBeenCalledWith('/api/v1/buyer/ai/reviews', { subjectType: 'demand', subjectId: 'd-1', expectedRevision: 'revision-1' });
});
it('encodes run IDs and records only feedback', async () => {
  await getAiReview('run/1');
  expect(http.get).toHaveBeenCalledWith('/api/v1/buyer/ai/reviews/run%2F1', { signal: undefined });
  await saveAiFeedback('run/1', { findingId: 'finding-1', disposition: 'needs_review', comment: '人工复核' });
  expect(http.post).toHaveBeenCalledWith('/api/v1/buyer/ai/reviews/run%2F1/feedback', { findingId: 'finding-1', disposition: 'needs_review', comment: '人工复核' });
});
