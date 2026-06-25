import { BarChart3 } from 'lucide-react';
import { useSupplierQuoteListList } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 报价记录:供应商已提交的报价与状态。
export function QuotesPage() {
  const quotes = useSupplierQuoteListList();
  const list = quotes.data?.data ?? [];

  return (
    <Panel title="报价记录" icon={BarChart3} subtitle="已提交报价 · 状态跟踪">
      <ListToolbar title="报价记录" recordCount={list.length} filterLabel="全部" actionLabel="我的报价" />
      {quotes.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载报价记录…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无报价记录。在询价邀请中提交报价后出现在此。" />
      ) : (
        <div className="space-y-3">
          {list.map((q) => (
            <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-mono font-black text-slate-950">{q.rfqId}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">报价 {q.id}</p>
                </div>
                {q.status && <StatusPill label={q.status} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniFact label="报价金额" value={currency(q.amount)} />
                <MiniFact label="税率" value={q.taxRate != null ? `${q.taxRate}%` : '—'} />
                <MiniFact label="交期" value={q.deliveryDays != null ? `${q.deliveryDays} 天` : '—'} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
