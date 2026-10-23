import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QualificationReviewPanel } from './qualification-review-panel';
const mocks = vi.hoisted(() => ({ can: true, decide: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => mocks.can }) }));
vi.mock('@24bid/api-client', () => ({
  qualificationReviews: async () => [{ id: 1, relationId: 'r', qualificationId: 'new', previousId: 'old', supplierName: '供应商', qualificationType: '许可证', status: 'pending', createdAt: '2026-10-23T01:00:00Z' }],
  decideQualificationReview: mocks.decide,
  downloadReport: vi.fn(),
}));
afterEach(cleanup);
beforeEach(() => { mocks.can = true; vi.clearAllMocks(); });
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QualificationReviewPanel /></QueryClientProvider>);
it('requires an opinion and submits an explicit rejection', async () => {
  show();
  fireEvent.click(await screen.findByRole('button', { name: '办理复核' }));
  fireEvent.click(screen.getByRole('button', { name: '退回补件' }));
  expect(mocks.decide).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('资质复核意见'), { target: { value: '请补充清晰原件' } });
  fireEvent.click(screen.getByRole('button', { name: '退回补件' }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith(1, false, '请补充清晰原件'));
});
it('read-only users can inspect originals but cannot decide', async () => {
  mocks.can = false; show();
  expect(await screen.findByRole('button', { name: '新版原件' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '办理复核' })).toBeNull();
});
