import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import { financeErrorMessage } from '../finance/finance-feedback';
import {
  useContractScheduleGenerate,
  useContractScheduleLineItems,
  useMonetaryContractMilestones,
  useContractScheduleReach,
} from '@24bid/api-client';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 里程碑确认履约条件，已付状态由统一财务登记同步。
export function ContractScheduleSection({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const lineItems = useContractScheduleLineItems(contractId);
  const milestones = useMonetaryContractMilestones(contractId);
  const reach = useContractScheduleReach();
  const generate = useContractScheduleGenerate();

  const lines = lineItems.data?.data ?? [];
  const ms = milestones.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).includes('payment-milestones'),
    });

  if (lineItems.isError || milestones.isError) {
    return <FeedbackNotice tone="error" message={financeErrorMessage(lineItems.error ?? milestones.error, '合同付款计划加载失败，请刷新重试。')} />;
  }
  if (lineItems.isLoading || milestones.isLoading) {
    return <p role="status" className="py-3 text-sm text-slate-500">加载合同付款计划…</p>;
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/30 p-3">
      {(generate.isError || reach.isError) && <FeedbackNotice tone="error" message={financeErrorMessage(generate.error ?? reach.error, '操作失败，请刷新重试。')} />}
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
        <a href={new URLSearchParams(window.location.search).get('solution') === 'ludong-poc' ? '?solution=ludong-poc&module=invoices' : '?module=invoices'} className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
          付款台账<ArrowUpRight size={14} aria-hidden="true" />
        </a>
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
          {ms.map((m, i) => {
            const paid = m.status === '已付';
            const reachBusy = reach.isPending && reach.variables?.milestoneId === m.id;
            // 按序达成:仅前序均已达成的下一个里程碑可确认达成。
            const canReach = !m.reached && ms.slice(0, i).every((p) => p.reached);
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900">
                    {m.name} · {m.percent}% · {currency(m.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{m.paymentVerified === false ? '历史付款金额待核对' : `累计已付 ${currency(m.paidAmount ?? undefined)} · 剩余 ${currency(m.remainingAmount ?? undefined)}`}</p>
                  {m.reachedAt && !paid && (
                    <p className="text-[11px] font-bold text-slate-400">达成 {m.reachedAt.slice(0, 10)}</p>
                  )}
                  {m.paidAt && <p className="text-[11px] font-bold text-slate-400">付款 {m.paidAt.slice(0, 10)}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 whitespace-nowrap">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${m.reached ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {m.reached ? '已达成' : '未达成'}
                  </span>
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.status}
                  </span>
                  {canReach && m.id && (
                    <button type="button" onClick={() => reach.mutate({ contractId, milestoneId: m.id! }, { onSuccess: refresh })}
                      disabled={reachBusy}
                      className="inline-flex h-7 items-center rounded-md border border-blue-200 bg-white px-3 text-[11px] font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      {reachBusy ? '确认中' : '确认达成'}
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
