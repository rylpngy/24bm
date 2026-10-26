import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderCancellationPanel } from './order-cancellation-panel';
afterEach(cleanup);
function state() {
  return {
    data: {
      blockers: [] as string[],
      actorId: 'buyer',
      items: [
        {
          id: 'c',
          status: 'pending',
          reason: '计划调整',
          createdBy: 'buyer',
          createdAt: '2026-10-26T10:00:00',
        },
      ],
      total: 1,
    },
    page: 1,
    setPage: vi.fn(),
    loading: false,
    loadError: false,
    error: '',
    busy: false,
    refresh: vi.fn(),
    act: vi.fn().mockResolvedValue(true),
  };
}
it('separates supplier acceptance from buyer withdrawal and read-only access', () => {
  const s = state();
  const v = render(<OrderCancellationPanel state={s} canManage />);
  expect(screen.getByRole('button', { name: '撤回本人申请' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '同意取消' })).toBeNull();
  v.rerender(<OrderCancellationPanel state={s} supplier canManage />);
  expect(screen.getByRole('button', { name: '同意取消' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '撤回本人申请' })).toBeNull();
  v.rerender(<OrderCancellationPanel state={s} supplier />);
  expect(screen.queryByRole('button', { name: '同意取消' })).toBeNull();
});
it('requires a reason before confirming and preserves a failed dialog', async () => {
  const s = state();
  s.act.mockResolvedValue(false);
  render(<OrderCancellationPanel state={s} supplier canManage />);
  fireEvent.click(screen.getByRole('button', { name: '同意取消' }));
  const confirm = screen.getByRole('button', { name: '确定' });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/办理原因/), {
    target: { value: '确认未发货，同意取消' },
  });
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(s.act).toHaveBeenCalledWith('accept', '确认未发货，同意取消', 'c'),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
});
it('hides blocked initiation and other users withdrawal and shows API errors', () => {
  const s = state();
  s.data.actorId = 'other';
  s.data.blockers = ['已有关联合同'];
  s.error = '申请已变化';
  render(<OrderCancellationPanel state={s} canManage />);
  expect(screen.queryByRole('button', { name: '申请取消订单' })).toBeNull();
  expect(screen.queryByRole('button', { name: '撤回本人申请' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('申请已变化');
  expect(screen.getByText('已有关联合同')).toBeTruthy();
});
