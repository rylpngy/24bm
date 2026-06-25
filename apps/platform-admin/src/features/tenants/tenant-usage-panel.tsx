import { useQueryClient } from '@tanstack/react-query';
import {
  usePlatformBillingGenerateStatement,
  usePlatformBillingIssueStatement,
  usePlatformBillingPayStatement,
  usePlatformBillingStatements,
  usePlatformBillingUsage,
  usePlatformTenantPlanChanges,
} from '@24bid/api-client';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const STMT_STYLE: Record<string, string> = {
  草稿: 'bg-slate-200 text-slate-600',
  已开票: 'bg-amber-100 text-amber-700',
  已结清: 'bg-emerald-100 text-emerald-700',
};

// 用量与计费:各计量项 配额/用量/超额/超额费用 + 月基础费 + 超额合计 + 本月应付。
export function TenantUsagePanel({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const query = usePlatformBillingUsage(tenantId);
  const statements = usePlatformBillingStatements(tenantId);
  const generate = usePlatformBillingGenerateStatement();
  const issue = usePlatformBillingIssueStatement();
  const pay = usePlatformBillingPayStatement();
  const planChanges = usePlatformTenantPlanChanges(tenantId);
  const usage = query.data?.data;
  const stmtList = statements.data?.data ?? [];
  const changeList = planChanges.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('billing-statements'),
    });

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

      <div className="mt-3 border-t border-indigo-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black text-indigo-700">账单(生成 · 开票 · 收款)</p>
          <button
            type="button"
            onClick={() =>
              generate.mutate({ tenantId, params: {} }, { onSuccess: refresh })
            }
            disabled={generate.isPending}
            className="inline-flex h-7 items-center rounded-md bg-indigo-600 px-3 text-[11px] font-black text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generate.isPending ? '生成中…' : '生成本月账单'}
          </button>
        </div>
        {stmtList.length === 0 ? (
          <p className="mt-2 text-[11px] font-bold text-slate-400">暂无账单。点「生成本月账单」创建当期快照。</p>
        ) : (
          <div className="mt-2 space-y-2">
            {stmtList.map((s) => {
              const busyI = issue.isPending && issue.variables?.statementId === s.id;
              const busyP = pay.isPending && pay.variables?.statementId === s.id;
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900">
                      {s.period} · {currency(s.totalAmount)}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      基础 {currency(s.basePrice)} · 超额 {currency(s.overageTotal)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${STMT_STYLE[s.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {s.status}
                    </span>
                    {s.status === '草稿' && s.id && (
                      <button type="button" onClick={() => issue.mutate({ tenantId, statementId: s.id! }, { onSuccess: refresh })}
                        disabled={busyI}
                        className="inline-flex h-7 items-center rounded-md border border-amber-200 bg-white px-3 text-[11px] font-black text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                        {busyI ? '开票中' : '开票'}
                      </button>
                    )}
                    {s.status === '已开票' && s.id && (
                      <button type="button" onClick={() => pay.mutate({ tenantId, statementId: s.id! }, { onSuccess: refresh })}
                        disabled={busyP}
                        className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                        {busyP ? '收款中' : '登记收款'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {changeList.length > 0 && (
        <div className="mt-3 border-t border-indigo-100 pt-3">
          <p className="text-xs font-black text-indigo-700">套餐变更记录</p>
          <div className="mt-2 space-y-1.5">
            {changeList.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
                <span>
                  <span className="font-mono">{c.fromPlan}</span> → <span className="font-mono">{c.toPlan}</span>
                  <span className="ml-1 text-slate-400">(上限 {c.fromUserLimit}→{c.toUserLimit})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 font-black ${c.direction === '升级' ? 'bg-emerald-100 text-emerald-700' : c.direction === '降级' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                    {c.direction}
                  </span>
                  <span className="text-slate-400">{c.changedAt?.slice(0, 10)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
