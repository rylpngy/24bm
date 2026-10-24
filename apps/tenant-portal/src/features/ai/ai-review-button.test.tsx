import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AiReviewButton } from './ai-review-button';

const permissions = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => permissions.allowed }) }));
vi.mock('./ai-review-panel', () => ({ AiReviewPanel: ({ subjectId, onClose }: { subjectId: string; onClose: () => void }) => <div role="dialog" aria-label="AI辅助评审">{subjectId}<button onClick={onClose}>关闭</button></div> }));
afterEach(() => { cleanup(); permissions.allowed = true; });

it('opens a subject-specific review without changing business decisions', async () => {
  const view = render(<AiReviewButton subjectType="demand" subjectId="demand-1" />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'AI辅助评审' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('demand-1');
  view.rerender(<AiReviewButton subjectType="demand" subjectId="demand-2" />);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('does not show an AI entry to unauthorized users or missing subjects', () => {
  permissions.allowed = false;
  const view = render(<AiReviewButton subjectType="supplier" subjectId="supplier-1" />);
  expect(screen.queryByRole('button')).toBeNull();
  permissions.allowed = true;
  view.rerender(<AiReviewButton subjectType="supplier" subjectId="" />);
  expect(screen.queryByRole('button')).toBeNull();
});
