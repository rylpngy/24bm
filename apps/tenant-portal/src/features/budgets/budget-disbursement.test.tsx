import { expect, it } from 'vitest';
import { formatBudgetAmount } from './budget-workspace';

it('does not turn unknown payments into a zero-valued amount', () => {
  expect(formatBudgetAmount(null)).toBe('待核对');
  expect(formatBudgetAmount(undefined)).toBe('待核对');
});
it('distinguishes a verified zero payment', () => {
  expect(formatBudgetAmount(0)).toBe('¥0.00');
});
it('preserves cents and negative balances in budget displays', () => {
  expect(formatBudgetAmount(1200.01)).toBe('¥1,200.01');
  expect(formatBudgetAmount(-100.05)).toBe('¥-100.05');
});
