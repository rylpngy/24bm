import { useEffect } from 'react';
export type SettlementFundingBasis = {
  projectId: string;
  planId: string;
  period: string;
  sources: {
    fundId: string;
    code: string;
    name: string;
    allocatedAmount: number;
    paidAmount: number;
    remainingAmount: number;
  }[];
  original: { source: string; fundId: string; amount: number }[];
};
export type SettlementFundingEntry = {
  evidenceId: string;
  fundId: string;
  code: string;
  name: string;
  amount: number;
};
const cents = (s: string) =>
  s === ''
    ? 0
    : /^\d+(\.\d{1,2})?$/.test(s) &&
        Number.isSafeInteger(Math.round(Number(s) * 100))
      ? Math.round(Number(s) * 100)
      : null;
const money = (n: number) =>
  n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
export function SettlementFundingFields({
  basis,
  entries,
  evidence,
  kind,
  source,
  amount,
  value,
  onChange,
  onReady,
}: {
  basis: SettlementFundingBasis;
  entries: SettlementFundingEntry[];
  evidence: { id: string; source?: string | null }[];
  kind: string;
  source: string;
  amount: string;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onReady: (v: boolean) => void;
}) {
  const rows = basis.sources.map((s) => {
    const own = entries.filter((e) => e.fundId === s.fundId);
    const bound = own.filter((e) =>
      evidence.some((p) => p.id === e.evidenceId && p.source === source),
    );
    const max =
      kind === 'refund'
        ? basis.original
            .filter((o) => o.source === source && o.fundId === s.fundId)
            .reduce((n, o) => n + o.amount, 0) +
          bound.reduce((n, e) => n + e.amount, 0)
        : s.remainingAmount - own.reduce((n, e) => n + e.amount, 0);
    return { ...s, max };
  });
  const sum = rows.reduce((n, s) => n + (cents(value[s.fundId] || '') || 0), 0),
    target = cents(amount);
  const ready =
    !!source &&
    target !== null &&
    target > 0 &&
    sum === target &&
    rows.every((s) => {
      const a = cents(value[s.fundId] || '');
      return a !== null && a <= Math.round(s.max * 100);
    });
  useEffect(() => {
    onReady(ready);
    return () => onReady(false);
  }, [ready, onReady]);
  return (
    <section
      aria-label="清算资金来源"
      className="space-y-3 border-t border-slate-200 pt-3"
    >
      <h4 className="font-semibold">{basis.period} 年度资金来源</h4>
      {rows.map((s) => (
        <label key={s.fundId} className="grid min-w-0 gap-2 sm:grid-cols-2">
          <span className="break-words text-sm">
            {s.code} · {s.name}
            <span className="block text-xs text-slate-500">
              本项可{kind === 'refund' ? '退' : '付'} {money(s.max)}
            </span>
          </span>
          <input
            aria-label={'清算来源金额 ' + s.code}
            type="number"
            min="0"
            max={s.max}
            step="0.01"
            value={value[s.fundId] || ''}
            onChange={(e) => onChange({ ...value, [s.fundId]: e.target.value })}
            className="h-10 w-full min-w-0 rounded-md border border-slate-200 px-3 text-sm"
          />
        </label>
      ))}
      <p
        role="status"
        className={'text-sm ' + (ready ? 'text-emerald-700' : 'text-amber-700')}
      >
        来源合计 {money(sum / 100)} / 凭证金额 {money(Number(amount) || 0)}
        {!ready ? '，请核对归属、金额与各来源限额。' : ''}
      </p>
    </section>
  );
}
