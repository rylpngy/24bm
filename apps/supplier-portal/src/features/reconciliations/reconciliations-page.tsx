import { useState } from 'react';
import { Scale } from 'lucide-react';
import { useSupplierInvoiceReconciliationList } from '@24bid/api-client';
import {
  FilterTabs,
  FeedbackNotice,
  Pagination,
  Panel,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

// 对账单:订单-发票三单对账(金额/收货/回款),只读视图,差异红色高亮。
export function ReconciliationsPage() {
  const recon = useSupplierInvoiceReconciliationList();
  const [keyword, setKeyword] = useState('');
  const [stageFilter, setStageFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = recon.data?.data ?? [];
  const stages = ['全部', ...Array.from(new Set(all.map((r) => r.stage).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((r) => {
    if (stageFilter !== '全部' && r.stage !== stageFilter) return false;
    if (!kw) return true;
    return [r.reconciliationNo, r.orderId, r.invoiceId].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const stageCount = (s: string) => (s === '全部' ? all.length : all.filter((r) => r.stage === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Panel title="对账单" icon={Scale} subtitle="订单-发票对账 · 差异与回款跟踪">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={stages.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : stageCount(s) }))}
          value={stageFilter}
          onChange={(id) => {
            setStageFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按对账单号 / 订单号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {recon.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载对账单…" />
      ) : recon.isError ? (
        <FeedbackNotice tone="error" message="对账单加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || stageFilter !== '全部'
              ? '没有符合条件的对账单。'
              : '暂无对账单。开票后系统自动生成订单-发票对账记录。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((r, i) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {r.reconciliationNo ?? r.id}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">订单 {r.orderId}</p>
                  </div>
                  {r.stage && <StatusPill label={r.stage} />}
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  发票 {currency(r.invoiceAmount)} · 差异{' '}
                  <span className={(r.varianceAmount ?? 0) !== 0 ? 'font-black text-red-600' : 'text-emerald-600'}>
                    {currency(r.varianceAmount)}
                  </span>
                </p>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">对账单号</th>
                  <th className="px-5 py-4">关联订单</th>
                  <th className="px-5 py-4 text-right">订单金额</th>
                  <th className="px-5 py-4 text-right">发票金额</th>
                  <th className="px-5 py-4 text-right">差异</th>
                  <th className="px-5 py-4">收货 / 回款</th>
                  <th className="px-5 py-4">对账阶段</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((r, i) => (
                  <tr key={r.id} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-mono text-xs font-black text-slate-900">{r.reconciliationNo ?? r.id}</p>
                      {r.nextAction && (
                        <p className="mt-1 max-w-xs truncate text-[11px] font-bold text-slate-400">下一步:{r.nextAction}</p>
                      )}
                    </td>
                    <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{r.orderId ?? '—'}</td>
                    <td className="px-5 py-5 text-right font-mono font-bold text-slate-700">{currency(r.orderAmount)}</td>
                    <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(r.invoiceAmount)}</td>
                    <td
                      className={cn(
                        'px-5 py-5 text-right font-mono font-black',
                        (r.varianceAmount ?? 0) !== 0 ? 'text-red-600' : 'text-emerald-600',
                      )}
                    >
                      {currency(r.varianceAmount)}
                    </td>
                    <td className="px-5 py-5 text-xs font-bold text-slate-600">
                      {r.receiptStatus ?? '—'} / {r.paymentStatus ?? '—'}
                    </td>
                    <td className="px-5 py-5">{r.stage && <StatusPill label={r.stage} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
