import { useBuyerFinanceActionThreeWayMatchLines } from '@24bid/api-client';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 行级三单对账状态 → 徽章配色。
const STATUS_STYLE: Record<string, string> = {
  三单一致: 'bg-emerald-100 text-emerald-700',
  金额差异: 'bg-red-100 text-red-700',
  数量短缺: 'bg-amber-100 text-amber-700',
  未开票: 'bg-slate-200 text-slate-600',
  待收货: 'bg-slate-200 text-slate-600',
};

// 行级三单匹配:订单行项↔收货行项↔发票行项逐行对照,标注每行的金额差异/数量短缺。
export function InvoiceLineMatchPanel({ invoiceId }: { invoiceId: string }) {
  const query = useBuyerFinanceActionThreeWayMatchLines(invoiceId);
  const lines = query.data?.data ?? [];

  if (query.isLoading) {
    return <p className="mt-2 px-1 text-xs font-bold text-slate-400">加载行级对账…</p>;
  }
  if (lines.length === 0) {
    return (
      <p className="mt-2 px-1 text-xs font-bold text-slate-400">
        暂无行级明细（该发票或订单未登记行项)。
      </p>
    );
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
          <tr>
            <th className="px-3 py-1.5">品名/规格</th>
            <th className="px-3 py-1.5 text-right">订购</th>
            <th className="px-3 py-1.5 text-right">收货/合格</th>
            <th className="px-3 py-1.5 text-right">开票</th>
            <th className="px-3 py-1.5 text-right">订单/发票金额</th>
            <th className="px-3 py-1.5 text-right">差异</th>
            <th className="px-3 py-1.5">行结论</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l) => (
            <tr key={l.orderLineId} className="font-bold text-slate-700">
              <td className="px-3 py-1.5">{l.description}</td>
              <td className="px-3 py-1.5 text-right">
                {l.orderedQuantity}
                {l.unit ? ` ${l.unit}` : ''}
              </td>
              <td className="px-3 py-1.5 text-right">
                {l.receivedQuantity ?? '—'}/{l.qualifiedQuantity ?? '—'}
              </td>
              <td className="px-3 py-1.5 text-right">{l.invoicedQuantity ?? '—'}</td>
              <td className="px-3 py-1.5 text-right">
                {currency(l.orderLineAmount)} / {currency(l.invoiceLineAmount)}
              </td>
              <td
                className={`px-3 py-1.5 text-right font-black ${
                  (l.amountVariance ?? 0) !== 0 ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {(l.amountVariance ?? 0) !== 0 ? currency(l.amountVariance) : '—'}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${
                    STATUS_STYLE[l.lineMatchStatus ?? ''] ?? 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {l.lineMatchStatus ?? '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
