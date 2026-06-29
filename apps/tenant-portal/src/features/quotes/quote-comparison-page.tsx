import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useBuyerSupplierList, useRfqAwardAward, useRfqList } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Pagination, Panel, SearchInput, StatusPill, cn } from '@24bid/ui';
import { QuoteComparisonTable } from '../rfqs/quote-comparison-table';
import { BidEvaluationPanel } from './bid-evaluation-panel';

const PAGE_SIZE = 5;

// 报价对比:跨 RFQ 的比价定标工作台——汇总已收到报价的询价,逐个比价并定标。
export function QuoteComparisonPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const rfqs = useRfqList();
  const admittedSuppliers = useBuyerSupplierList({ status: '已准入' });
  const award = useRfqAwardAward();

  const withQuotes = (rfqs.data?.data ?? []).filter((r) => (r.quotes ?? []).length > 0);
  const statuses = ['全部', ...Array.from(new Set(withQuotes.map((r) => r.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = withQuotes.filter((r) => {
    if (statusFilter !== '全部' && r.status !== statusFilter) return false;
    if (!kw) return true;
    return [r.title, r.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const statusCount = (s: string) =>
    s === '全部' ? withQuotes.length : withQuotes.filter((r) => r.status === s).length;
  const awardable = withQuotes.filter((r) => r.status === '报价中').length;
  const totalQuotes = withQuotes.reduce((sum, r) => sum + (r.quotes ?? []).length, 0);

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

  const submitAwardWithReason = (rfqId: string, quoteId: string, reason: string) =>
    award.mutate({ rfqId, data: { quoteId, reason } }, { onSuccess: () => refresh() });

  return (
    <Panel title="报价对比" icon={BarChart3} subtitle="跨询价比价 · 定标入口">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MiniFact label="有报价询价" value={String(withQuotes.length)} />
        <MiniFact label="可定标(报价中)" value={String(awardable)} />
        <MiniFact label="累计收到报价" value={String(totalQuotes)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === statusFilter
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {s !== '全部' && statusCount(s) > 0 && <span className="ml-1 text-slate-400">{statusCount(s)}</span>}
            </button>
          ))}
        </div>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按标题 / 编号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载报价…" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的询价。'
              : '暂无已收到报价的询价。供应商提交报价后在此比价定标。'
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {pageItems.map((r, i) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}.
                      </span>
                      {r.title}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{r.id}</p>
                  </div>
                  {r.status && <StatusPill label={r.status} />}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="收到报价" value={String((r.quotes ?? []).length)} />
                  <MiniFact label="评选方式" value={r.evaluationMethod ?? '最低价'} />
                  <MiniFact label="报价截止" value={r.deadlineAt?.slice(0, 10) ?? '—'} />
                </div>
                {r.id && (
                  <div className="mt-3">
                    <BidEvaluationPanel
                      rfqId={r.id}
                      supplierNames={supplierNames}
                      canAward={r.status === '报价中'}
                      awarding={award.isPending && award.variables?.rfqId === r.id}
                      onAward={(quoteId, reason) => r.id && submitAwardWithReason(r.id, quoteId, reason)}
                    />
                  </div>
                )}
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
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
