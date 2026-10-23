import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuyerNotifications } from './buyer-notifications';
const state = vi.hoisted(() => ({ failed: false, loading: false, mutate: vi.fn(), refetch: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useBuyerNotificationList: () => ({ data: { data: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, title: `任务${i}`, content: '通知内容', read: i === 0 })) }, isError: state.failed, isLoading: state.loading, refetch: state.refetch }),
  useBuyerNotificationMarkRead: () => ({ mutate: state.mutate, isPending: false }),
}));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); state.failed = false; state.loading = false; });
it('paginates notices and retains read status', () => {
  render(<BuyerNotifications />);
  expect(screen.getByText('已读')).toBeTruthy();
  expect(screen.queryByText('任务5')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '下一页通知' }));
  expect(screen.getByText('任务5')).toBeTruthy();
});
it('marks only the selected notification and refreshes after success', () => {
  render(<BuyerNotifications />);
  fireEvent.click(screen.getByRole('button', { name: '标为已读：任务1' }));
  expect(state.mutate.mock.calls[0][0]).toEqual({ notificationId: 'n1' });
  state.mutate.mock.calls[0][1].onSuccess();
  expect(state.refetch).toHaveBeenCalledOnce();
});
it('shows a retryable load error', () => {
  state.failed = true;
  render(<BuyerNotifications />);
  expect(screen.getByRole('alert').textContent).toContain('通知加载失败');
  fireEvent.click(screen.getByRole('button', { name: '刷新通知' }));
  expect(state.refetch).toHaveBeenCalledOnce();
});
