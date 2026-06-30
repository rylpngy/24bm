import { Award, FileText } from 'lucide-react';
import { useRfqResult } from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 采购方:已定标 RFQ 的结果公示——中标人 + 中标通知书 + 本轮报价排名。
export function RfqResultBuyer({ rfqId, supplierNames }: { rfqId: string; supplierNames: Record<string, string> }) {
  const result = useRfqResult(rfqId);
  const d = result.data?.data;
  const name = (id?: string) => (id ? (supplierNames[id] ?? id) : '—');

  if (result.isLoading) return <p className="mt-3 text-xs font-bold text-slate-400">加载结果…</p>;
  if (!d) return null;

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-emerald-800">
        <Award size={16} /> 定标结果公示
      </p>
      <div className="mt-2 rounded-lg border border-emerald-100 bg-white p-3">
        <p className="text-xs font-black text-slate-500">中标供应商</p>
        <p className="mt-0.5 text-base font-black text-emerald-700">
          {name(d.winnerSupplierId)}
          <span className="ml-2 text-sm text-slate-500">{currency(d.winnerAmount)}</span>
        </p>
        {d.awardReason && <p className="mt-1 text-[11px] font-bold text-slate-400">定标理由:{d.awardReason}</p>}
      </div>

      {(d.rankings ?? []).length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
              <tr>
                <th className="px-3 py-1.5">名次</th>
                <th className="px-3 py-1.5">供应商</th>
                <th className="px-3 py-1.5 text-right">含税总价</th>
                <th className="px-3 py-1.5 text-right">交期</th>
                <th className="px-3 py-1.5 text-right">结果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(d.rankings ?? []).map((r) => (
                <tr key={r.supplierId} className={cn('font-bold', r.awarded ? 'bg-emerald-50/60 text-emerald-700' : 'text-slate-600')}>
                  <td className="px-3 py-1.5">{r.rank}</td>
                  <td className="px-3 py-1.5">{name(r.supplierId)}</td>
                  <td className="px-3 py-1.5 text-right">{currency(r.amount)}</td>
                  <td className="px-3 py-1.5 text-right">{r.deliveryDays != null ? `${r.deliveryDays} 天` : '—'}</td>
                  <td className="px-3 py-1.5 text-right">
                    {r.awarded ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">★ 中标</span>
                    ) : (
                      <span className="text-[11px] text-slate-400">落标</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.notice && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-black text-slate-400">
            <FileText size={12} /> 中标通知书
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{d.notice}</p>
        </div>
      )}
      {result.isError && <FeedbackNotice tone="error" message="结果加载失败。" />}
    </div>
  );
}
