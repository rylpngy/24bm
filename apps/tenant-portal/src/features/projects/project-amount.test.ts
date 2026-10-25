import { expect, it } from 'vitest';
import { projectAmount } from './project-amount';
it('rounds each decimal line like Java BigDecimal rather than floating point multiplication', () => {
  expect(
    projectAmount([
      { quantity: 1, unitPrice: 1.005 },
      { quantity: 2, unitPrice: 123.4567 },
    ]),
  ).toBe(247.92);
  expect(
    projectAmount([
      { quantity: 0.1, unitPrice: 0.05 },
      { quantity: 0.1, unitPrice: 0.05 },
    ]),
  ).toBe(0.02);
});
it('does not preview out-of-contract precision, negative or non-finite input as valid money', () => {
  for (const unitPrice of [-1, NaN, Infinity, 0.00001])
    expect(projectAmount([{ quantity: 1, unitPrice }])).toBeNull();
});
