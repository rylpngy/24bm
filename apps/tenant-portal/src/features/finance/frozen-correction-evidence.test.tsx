import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { FrozenCorrectionEvidence } from './frozen-correction-evidence';
afterEach(cleanup);
it('shows the submitted partial amount and projected remainder without calling it the live balance', () => {
  render(
    <FrozenCorrectionEvidence
      snapshot={JSON.stringify({
        original: { id: 'old', amount: 200 },
        entries: [],
        remainingAmount: 140,
        correctionAmount: 40,
      })}
    />,
  );
  expect(screen.getByText('送审时可更正余额')).toBeTruthy();
  expect(
    within(screen.getByText('本次批准后原流水剩余').parentElement!).getByText(
      /100/,
    ),
  ).toBeTruthy();
});
it('reads legacy whole-remainder requests from their frozen entries rather than the original gross amount', () => {
  render(
    <FrozenCorrectionEvidence
      snapshot={JSON.stringify({
        original: { id: 'old', amount: 200 },
        entries: [
          { id: 'old', amount: 200 },
          { reversalOf: 'old', amount: -60 },
        ],
      })}
    />,
  );
  expect(
    within(screen.getByText('本次更正金额').parentElement!).getByText(/140/),
  ).toBeTruthy();
});
