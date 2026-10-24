import { afterEach, expect, it, vi } from 'vitest';
import { currentPerformanceQuarter, isPerformancePeriod } from './performance-period';

afterEach(() => vi.useRealTimers());

it.each(['0000', '0001', '0999', '0001-Q1', '0999-Q4', '0001-01', '0999-12'])('rejects unsupported year in %s', period => {
  expect(isPerformancePeriod(period)).toBe(false);
});

it.each(['1000', '9999', '1000-Q1', '9999-Q4', '1000-01', '9999-12'])('accepts supported boundary in %s', period => {
  expect(isPerformancePeriod(period)).toBe(true);
});

it.each([
  ['2001-03-31T15:59:59Z', '2001-Q1'],
  ['2001-03-31T16:00:00Z', '2001-Q2'],
  ['2001-12-31T16:00:00Z', '2002-Q1'],
])('uses Shanghai quarter at %s regardless of host timezone', (instant, quarter) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
  expect(currentPerformanceQuarter()).toBe(quarter);
});
