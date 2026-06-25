import { usePlatformBillingUsage } from '@24bid/api-client';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 用量与计费:各计量项 配额/用量/超额/超额费用 + 月基础费 + 超额合计 + 本月应付。
export function TenantUsagePanel({ tenantId }: { tenantId: string }) {
  const query = usePlatformBillingUsage(tenantId);
  const usage = query.data?.data;

  if (query.isLoading) {
    return <p className="mt-2 px-1 text-xs font-bold text-slate-400">加载用量计费…</p>;
  }
  if (!usage) {
    return <p className="mt-2 px-1 text-xs font-bold text-slate-400">暂无计费数据。</p>;
  }

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-black text-indigo-700">
          用量与计费 · {usage.planName}（月基础费 {currency(usage.monthlyBasePrice)}）
        </p>
        <p className="text-sm font-black text-slate-900">
          本月应付 <span className="text-indigo-700">{currency(usage.totalBill)}</span>
        </p>
      </div>
      <div className="mt-2 overflow-x-auto rounded-lg border border-indigo-100 bg-white">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead className="bg-indigo-50 text-[11px] font-black text-indigo-700">
            <tr>
              <th className="px-3 py-1.5">计量项</th>
              <th className="px-3 py-1.5 text-right">配额</th>
              <th className="px-3 py-1.5 text-right">用量</th>
              <th className="px-3 py-1.5 text-right">超额</th>
              <th className="px-3 py-1.5 text-right">超额单价</th>
              <th className="px-3 py-1.5 text-right">超额费用</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50">
            {(usage.lines ?? []).map((l) => {
              const over = (l.overage ?? 0) > 0;
              return (
                <tr key={l.metric} className={over ? 'bg-amber-50/50 font-bold' : 'font-bold text-slate-700'}>
                  <td className="px-3 py-1.5">{l.label}</td>
                  <td className="px-3 py-1.5 text-right">{l.includedQuota}</td>
                  <td className="px-3 py-1.5 text-right">{l.used}</td>
                  <td className={`px-3 py-1.5 text-right ${over ? 'text-amber-700' : 'text-slate-400'}`}>
                    {over ? `+${l.overage}` : '0'}
                  </td>
                  <td className="px-3 py-1.5 text-right">{currency(l.overageUnitPrice)}</td>
                  <td className={`px-3 py-1.5 text-right font-black ${over ? 'text-amber-700' : 'text-slate-400'}`}>
                    {currency(l.overageCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-indigo-100 font-black text-slate-900">
              <td className="px-3 py-1.5" colSpan={5}>
                超额合计
              </td>
              <td className="px-3 py-1.5 text-right text-amber-700">{currency(usage.overageTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
