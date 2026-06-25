import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useBuyerSupplierList, useRfqAwardAward, useRfqList } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';
import { QuoteComparisonTable } from '../rfqs/quote-comparison-table';

// 报价对比:跨 RFQ 的比价定标工作台——汇总已收到报价的询价,逐个比价并定标。
export function QuoteComparisonPage() {
  const queryClient = useQueryClient();
  const rfqs = useRfqList();
  const admittedSuppliers = useBuyerSupplierList({ status: '已准入' });
  const award = useRfqAwardAward();

  const list = (rfqs.data?.data ?? []).filter((r) => (r.quotes ?? []).length > 0);

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    (admittedSuppliers.data?.data ?? []).forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [admittedSuppliers.data]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(rfqs|orders)/.test(q.queryKey[0] as string),
    });

  const submitAward = (rfqId: string, quoteId: string) =>
    award.mutate(
      { rfqId, data: { quoteId, reason: '含税总价与交期综合最优' } },
      { onSuccess: () => refresh() },
    );

  return (
    <Panel title="报价对比" icon={BarChart3} subtitle="跨询价比价 · 定标入口">
      <ListToolbar title="待比价询价" recordCount={list.length} filterLabel="已收到报价" actionLabel="比价定标" />

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载报价…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无已收到报价的询价。供应商提交报价后在此比价定标。" />
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{r.title}</p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-500">{r.id}</p>
                </div>
                {r.status && <StatusPill label={r.status} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniFact label="收到报价" value={String((r.quotes ?? []).length)} />
                <MiniFact label="评选方式" value={r.evaluationMethod ?? '最低价'} />
                <MiniFact label="报价截止" value={r.deadlineAt?.slice(0, 10) ?? '—'} />
              </div>
              <div className="mt-3">
                <QuoteComparisonTable
                  quotes={r.quotes ?? []}
                  supplierNames={supplierNames}
                  canAward={r.status === '报价中'}
                  awardingQuoteId={award.isPending ? (award.variables?.data.quoteId ?? null) : null}
                  onAward={(quoteId) => r.id && submitAward(r.id, quoteId)}
                />
                {r.status !== '报价中' && (
                  <p className="mt-2 text-xs font-bold text-slate-400">
                    当前状态「{r.status}」,定标入口仅在报价中开放。
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
