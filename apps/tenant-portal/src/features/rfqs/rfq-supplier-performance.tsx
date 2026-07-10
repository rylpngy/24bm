import { Star } from 'lucide-react';
import { useRfqSupplierPerformance } from '@24bid/api-client';
import { cn } from '@24bid/ui';

// 分级配色:A 绿 / B 蓝 / C 橙 / 其它灰。
const tierCls = (tier?: string | null) => {
  if (!tier) return 'bg-slate-100 text-slate-500';
  if (tier.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
  if (tier.startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (tier.startsWith('C')) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

// 绩效复盘联动定标:报价供应商最新历史绩效(总分+分级),供定标参考。
export function RfqSupplierPerformance({
  rfqId,
  supplierNames,
}: {
  rfqId: string;
  supplierNames: Record<string, string>;
}) {
  const perf = useRfqSupplierPerformance(rfqId);
  const rows = perf.data?.data ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black text-indigo-700">
        <Star size={13} /> 供应商历史绩效(定标参考)
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((r) => (
          <span
            key={r.supplierId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600"
          >
            {supplierNames[r.supplierId ?? ''] ?? r.supplierId}
            {r.hasHistory ? (
              <>
                <span className="font-black text-slate-800">{r.totalScore}</span>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-black', tierCls(r.tier))}>
                  {r.tier}
                </span>
              </>
            ) : (
              <span className="text-slate-400">无历史绩效</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
