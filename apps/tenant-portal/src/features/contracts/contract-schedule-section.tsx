import { useQueryClient } from '@tanstack/react-query';
import {
  useContractScheduleGenerate,
  useContractScheduleLineItems,
  useContractScheduleMilestones,
  useContractSchedulePay,
} from '@24bid/api-client';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 合同行项(派生自关联订单)+ 付款计划(里程碑生成 / 逐项登记付款)。
export function ContractScheduleSection({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const lineItems = useContractScheduleLineItems(contractId);
  const milestones = useContractScheduleMilestones(contractId);
  const generate = useContractScheduleGenerate();
  const pay = useContractSchedulePay();

  const lines = lineItems.data?.data ?? [];
  const ms = milestones.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).includes('payment-milestones'),
    });

  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/30 p-3">
      <p className="text-xs font-black text-violet-700">合同行项（源自关联订单）</p>
      {lines.length === 0 ? (
        <p className="mt-1 text-[11px] font-bold text-slate-400">关联订单暂无行项。</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-violet-100 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-violet-50 text-[11px] font-black text-violet-700">
              <tr>
                <th className="px-3 py-1.5">品名/规格</th>
                <th className="px-3 py-1.5 text-right">数量</th>
                <th className="px-3 py-1.5 text-right">单价</th>
                <th className="px-3 py-1.5 text-right">行金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {lines.map((l) => (
                <tr key={l.orderLineId} className="font-bold text-slate-700">
                  <td className="px-3 py-1.5">{l.description}</td>
                  <td className="px-3 py-1.5 text-right">
                    {l.quantity}
                    {l.unit ? ` ${l.unit}` : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right">{currency(l.unitPrice)}</td>
                  <td className="px-3 py-1.5 text-right font-black text-slate-900">{currency(l.lineAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-violet-700">付款计划（里程碑）</p>
        {ms.length === 0 && (
          <button
            type="button"
            onClick={() => generate.mutate({ contractId }, { onSuccess: refresh })}
            disabled={generate.isPending}
            className="inline-flex h-7 items-center rounded-md bg-violet-600 px-3 text-[11px] font-black text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {generate.isPending ? '生成中…' : '生成付款计划（30/40/30）'}
          </button>
        )}
      </div>
      {ms.length === 0 ? (
        <p className="mt-1 text-[11px] font-bold text-slate-400">尚未生成付款计划。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {ms.map((m) => {
            const paid = m.status === '已付';
            const busy = pay.isPending && pay.variables?.milestoneId === m.id;
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900">
                    {m.name} · {m.percent}% · {currency(m.amount)}
                  </p>
                  {m.paidAt && <p className="text-[11px] font-bold text-slate-400">付款 {m.paidAt.slice(0, 10)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.status}
                  </span>
                  {!paid && m.id && (
                    <button type="button" onClick={() => pay.mutate({ contractId, milestoneId: m.id! }, { onSuccess: refresh })}
                      disabled={busy}
                      className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                      {busy ? '登记中' : '登记付款'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
