import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PrimaryActionButton } from './primary-action-button';

afterEach(cleanup);

it('blocks clicks while busy even when callers do not separately disable it', () => {
  const save = vi.fn();
  render(<PrimaryActionButton busy pendingLabel="保存中" onClick={save}>保存</PrimaryActionButton>);
  const button = screen.getByRole('button', { name: '保存中' });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(save).not.toHaveBeenCalled();
});

it('explains a disabled action and returns to normal when enabled', () => {
  const save = vi.fn();
  const view = render(<PrimaryActionButton disabled disabledReason="请先选择收货地址" onClick={save}>提交</PrimaryActionButton>);
  expect(screen.getByRole('button')).toHaveAttribute('title', '请先选择收货地址');
  view.rerender(<PrimaryActionButton onClick={save}>提交</PrimaryActionButton>);
  fireEvent.click(screen.getByRole('button'));
  expect(save).toHaveBeenCalledOnce();
});
