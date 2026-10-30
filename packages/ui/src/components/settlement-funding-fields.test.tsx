import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import {
  SettlementFundingFields,
  type SettlementFundingEntry,
  type SettlementFundingBasis,
} from './settlement-funding-fields';
const basis = {
  projectId: 'p',
  planId: 'plan',
  period: '2026',
  sources: [
    {
      fundId: 'a',
      code: 'A',
      name: '专项A',
      allocatedAmount: 100,
      paidAmount: 60,
      remainingAmount: 40,
    },
    {
      fundId: 'b',
      code: 'B',
      name: '专项B',
      allocatedAmount: 100,
      paidAmount: 40,
      remainingAmount: 60,
    },
  ],
  original: [
    { source: 'inv-a', fundId: 'a', amount: 60 },
    { source: 'inv-a', fundId: 'b', amount: 40 },
  ],
};
function Harness({
  kind = 'refund',
  source = 'inv-a',
  amount = '50',
  entries = [] as SettlementFundingEntry[],
}) {
  const [value, setValue] = useState<Record<string, string>>({}),
    [ready, setReady] = useState(false);
  return (
    <>
      <SettlementFundingFields
        basis={basis}
        entries={entries}
        evidence={entries.map((x) => ({ id: x.evidenceId, source: 'inv-a' }))}
        kind={kind}
        source={source}
        amount={amount}
        value={value}
        onChange={setValue}
        onReady={setReady}
      />
      <button disabled={!ready}>保存凭证</button>
    </>
  );
}
it('requires exact source total and forbids refunding more than this invoice paid', () => {
  render(<Harness />);
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText('清算来源金额 B'), {
    target: { value: '50' },
  });
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText('清算来源金额 B'), {
    target: { value: '20' },
  });
  fireEvent.change(screen.getByLabelText('清算来源金额 A'), {
    target: { value: '30' },
  });
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    false,
  );
});
function HistoricalHarness({ kind = 'refund' }: { kind?: string }) {
  const [value, setValue] = useState<Record<string, string>>({}),
    [targets, setTargets] = useState<Record<string, string>>({}),
    [ready, setReady] = useState(false);
  const data: SettlementFundingBasis = {
    ...basis,
    period: '2027',
    sources: [
      { ...basis.sources[0], period: '2026', historical: true },
      { ...basis.sources[1], period: '2027', historical: false },
    ],
  };
  return (
    <>
      <SettlementFundingFields
        basis={data}
        entries={[]}
        evidence={[]}
        kind={kind}
        cashPeriod={kind === 'refund' ? '2026' : '2027'}
        source="inv-a"
        amount="30"
        value={value}
        onChange={setValue}
        targets={targets}
        onTargetsChange={setTargets}
        onReady={setReady}
      />
      <button disabled={!ready}>确认年度分账</button>
    </>
  );
}
it('requires a current-year restoration target for historical refunds', () => {
  render(<HistoricalHarness />);
  expect(screen.queryByLabelText('清算来源金额 B')).toBeNull();
  fireEvent.change(screen.getByLabelText('清算来源金额 A'), {
    target: { value: '30' },
  });
  expect(screen.getByText('确认年度分账')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('回补来源 A'), {
    target: { value: 'b' },
  });
  expect(screen.getByText('确认年度分账')).toBeEnabled();
});
it('never offers historical sources for topups', () => {
  render(<HistoricalHarness kind="payment" />);
  expect(screen.queryByLabelText('清算来源金额 A')).toBeNull();
  expect(screen.queryByLabelText('回补来源 A')).toBeNull();
  fireEvent.change(screen.getByLabelText('清算来源金额 B'), {
    target: { value: '30' },
  });
  expect(screen.getByText('确认年度分账')).toBeEnabled();
});
it('does not let an unpaid invoice borrow another invoice refund capacity', () => {
  render(<Harness source="inv-b" />);
  fireEvent.change(screen.getByLabelText('清算来源金额 A'), {
    target: { value: '50' },
  });
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    true,
  );
});
it('accounts for prior refunds in both remaining invoice cash and project payable capacity', () => {
  render(
    <Harness
      entries={[
        { evidenceId: 'e', fundId: 'a', code: 'A', name: '专项A', amount: -30 },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText('清算来源金额 A'), {
    target: { value: '50' },
  });
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    true,
  );
});
it('caps topup at current project source remaining amount', () => {
  render(<Harness kind="payment" source="inv-b" />);
  fireEvent.change(screen.getByLabelText('清算来源金额 A'), {
    target: { value: '50' },
  });
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText('清算来源金额 A'), {
    target: { value: '40' },
  });
  fireEvent.change(screen.getByLabelText('清算来源金额 B'), {
    target: { value: '10' },
  });
  expect((screen.getByText('保存凭证') as HTMLButtonElement).disabled).toBe(
    false,
  );
});
