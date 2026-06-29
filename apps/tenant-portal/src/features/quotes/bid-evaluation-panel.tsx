import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useRfqEvaluation } from '@24bid/api-client';
import { cn } from '@24bid/ui';

const PRESETS = [
  { label: '价格优先', p: 70, d: 30 },
  { label: '均衡', p: 50, d: 50 },
  { label: '交期优先', p: 30, d: 70 },
];

// 加权评标:按价格/交期权重对该 RFQ 的报价打分排名,高亮推荐项,可一键采用推荐定标。
export function BidEvaluationPanel({
  rfqId,
  supplierNames,
  canAward,
  awarding,
  onAward,
}: {
  rfqId: string;
  supplierNames: Record<string, string>;
  canAward: boolean;
  awarding: boolean;
  onAward: (quoteId: string, reason: string) => void;
}) {
  const [w, setW] = useState({ p: 70, d: 30 });
  const evalQ = useRfqEvaluation(rfqId, { priceWeight: w.p, deliveryWeight: w.d }, { query: {} });
  const data = evalQ.data?.data;
  const rows = data?.rows ?? [];

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs font-black text-indigo-700">
          <Sparkles size={14} /> 加权评标
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const on = w.p === preset.p && w.d === preset.d;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setW({ p: preset.p, d: preset.d })}
                className={cn(
                  'h-7 rounded-md border px-2 text-[11px] font-black transition',
                  on
                    ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] font-bold text-slate-400">
          价格 {w.p}% · 交期 {w.d}%
        </span>
      </div>

      {evalQ.isLoading ? (
        <p className="mt-2 text-[11px] font-bold text-slate-400">评标计算中…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[11px] font-bold text-slate-400">暂无报价可评。</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 pr-2 font-black">名次</th>
                <th className="py-1 pr-2 font-black">供应商</th>
                <th className="py-1 pr-2 text-right font-black">含税价</th>
                <th className="py-1 pr-2 text-right font-black">交期(天)</th>
                <th className="py-1 pr-2 text-right font-black">价格分</th>
                <th className="py-1 pr-2 text-right font-black">交期分</th>
                <th className="py-1 pr-2 text-right font-black">加权总分</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.quoteId}
                  className={cn(
                    'border-t border-slate-100',
                    r.recommended && 'bg-emerald-50/80',
                  )}
                >
                  <td className="py-1 pr-2 font-black text-slate-700">
                    {r.rank}
                    {r.recommended && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-black text-emerald-700">
                        推荐
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-2 font-bold text-slate-700">
                    {supplierNames[r.supplierId ?? ''] ?? r.supplierId}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono font-bold text-slate-600">
                    ¥{Number(r.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono font-bold text-slate-600">{r.deliveryDays}</td>
                  <td className="py-1 pr-2 text-right font-mono text-slate-500">{r.priceScore}</td>
                  <td className="py-1 pr-2 text-right font-mono text-slate-500">{r.deliveryScore}</td>
                  <td className="py-1 pr-2 text-right font-mono font-black text-slate-900">{r.weightedScore}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {canAward && data?.recommendedQuoteId && (
            <button
              type="button"
              onClick={() =>
                onAward(
                  data.recommendedQuoteId as string,
                  `加权评标推荐(价格${w.p}/交期${w.d}):综合得分最高`,
                )
              }
              disabled={awarding}
              className="mt-2 inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-[11px] font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {awarding ? '定标中…' : '采用推荐定标'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
