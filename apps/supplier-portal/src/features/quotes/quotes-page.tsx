import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useSupplierQuoteListList } from '@24bid/api-client';
import { FilterTabs, FeedbackNotice, Pagination, Panel, SearchInput, StatusPill} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

// 报价记录:供应商已提交的报价与状态。
export function QuotesPage() {
  const quotes = useSupplierQuoteListList();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = quotes.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((q) => q.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((q) => {
    if (statusFilter !== '全部' && q.status !== statusFilter) return false;
    if (!kw) return true;
    return [q.rfqId, q.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((q) => q.status === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Panel title="报价记录" icon={BarChart3} subtitle="已提交报价 · 状态跟踪">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({
            id: s,
            label: s,
            count: s === '全部' ? undefined : statusCount(s),
          }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按询比号 / 报价号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {quotes.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载报价记录…" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的报价。'
              : '暂无报价记录。在询比邀请中提交报价后出现在此。'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {q.status && <StatusPill label={q.status} />}
                      <span className="font-mono text-[11px] font-bold text-slate-400">报价 {q.id}</span>
                    </div>
                    <p className="mt-1.5 break-words font-mono text-[15px] font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {q.rfqId}
                    </p>
                    <p className="mt-1.5 text-xs font-bold text-slate-500">
                      税率 {q.taxRate != null ? `${q.taxRate}%` : '—'} · 承诺交期{' '}
                      {q.deliveryDays != null ? `${q.deliveryDays} 天` : '—'}
                      {q.submittedAt && (
                        <span className="ml-2 font-mono">提交于 {q.submittedAt.slice(0, 10)}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-black text-slate-400">报价金额(含税)</p>
                    <p className="mt-0.5 font-mono text-xl font-black text-slate-950">{currency(q.amount)}</p>
                  </div>
                </div>
                {(q.lineItems ?? []).length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                        <tr>
                          <th className="px-3 py-1.5">品名/规格</th>
                          <th className="px-3 py-1.5 text-right">数量</th>
                          <th className="px-3 py-1.5 text-right">单价</th>
                          <th className="px-3 py-1.5 text-right">行金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(q.lineItems ?? []).map((l) => (
                          <tr key={l.id} className="font-bold text-slate-700">
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
              </div>
            ))}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
