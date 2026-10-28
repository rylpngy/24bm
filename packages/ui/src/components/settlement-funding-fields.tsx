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
    period?: string;
    historical?: boolean;
  }[];
  original: { source: string; fundId: string; amount: number }[];
};
export type SettlementFundingEntry = {
  evidenceId: string;
  fundId: string;
  code: string;
  name: string;
  amount: number;
  targetFundId?: string | null;
  targetName?: string | null;
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
  cashPeriod,
  targets = {},
  onTargetsChange,
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
  cashPeriod?: string;
  targets?: Record<string, string>;
  onTargetsChange?: (v: Record<string, string>) => void;
}) {
  const rows = basis.sources
    .filter(
      (s) =>
        (!cashPeriod || !s.period || s.period === cashPeriod) &&
        (kind !== 'payment' || !s.historical),
    )
    .map((s) => {
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
      return (
        a !== null &&
        a <= Math.round(s.max * 100) &&
        (!s.historical ||
          a === 0 ||
          basis.sources.some(
            (t) => !t.historical && t.fundId === targets[s.fundId],
          ))
      );
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
      <h4 className="font-semibold">
        {kind === 'refund' ? '退款原资金来源' : basis.period + ' 年度资金来源'}
      </h4>
      {rows.map((s) => (
        <div key={s.fundId} className="grid min-w-0 gap-2 sm:grid-cols-2">
          <span className="break-words text-sm">
            {s.period || basis.period} · {s.code} · {s.name}
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
          {s.historical && kind === 'refund' && (
            <label className="text-sm sm:col-span-2">
              当前年度责任回补来源
              <select
                aria-label={'回补来源 ' + s.code}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3"
                value={targets[s.fundId] || ''}
                onChange={(e) =>
                  onTargetsChange?.({ ...targets, [s.fundId]: e.target.value })
                }
              >
                <option value="">请选择已批准来源</option>
                {basis.sources
                  .filter((t) => !t.historical)
                  .map((t) => (
                    <option key={t.fundId} value={t.fundId}>
                      {t.code} · {t.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
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
