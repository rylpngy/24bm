import { useState } from 'react';
import { Receipt } from 'lucide-react';
import { useSupplierReceivableList } from '@24bid/api-client';
import { FilterTabs, FeedbackNotice, MiniFact, Pagination, Panel, SearchInput, StatusPill} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

// 发票应收:供应商发票与回款状态。
export function ReceivablesPage() {
  const recv = useSupplierReceivableList();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = recv.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((inv) => inv.paymentStatus).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((inv) => {
    if (statusFilter !== '全部' && inv.paymentStatus !== statusFilter) return false;
    if (!kw) return true;
    return [inv.invoiceNo, inv.id, inv.orderId].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) =>
    s === '全部' ? all.length : all.filter((inv) => inv.paymentStatus === s).length;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Panel title="发票应收" icon={Receipt} subtitle="发票 · 回款状态">
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
          placeholder="按发票号 / 订单号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {recv.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载发票应收…" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的发票。'
              : '暂无发票。对已收货订单开票后出现在此。'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((inv, i) => (
              <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}.
                      </span>
                      {inv.invoiceNo ?? inv.id}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">订单 {inv.orderId}</p>
                  </div>
                  {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="发票金额" value={currency(inv.amount)} />
                  <MiniFact label="对账阶段" value={inv.reconciliationStage ?? '—'} />
                  <MiniFact label="到期日" value={inv.dueDate ?? '—'} />
                </div>
                {(inv.lineItems ?? []).length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                    <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      发票行项明细（{(inv.lineItems ?? []).length} 项）
                    </p>
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
                        {(inv.lineItems ?? []).map((l) => (
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
