import { Fragment, useState } from 'react';
import { Receipt } from 'lucide-react';
import { type InvoiceResponse, useSupplierReceivableList } from '@24bid/api-client';
import {
  FilterTabs,
  FeedbackNotice,
  MiniFact,
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

// 发票应收:供应商发票与回款状态。
export function ReceivablesPage() {
  const recv = useSupplierReceivableList();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const renderExpanded = (inv: InvoiceResponse) => (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <MiniFact label="对账阶段" value={inv.reconciliationStage ?? '—'} />
        <MiniFact label="收货状态" value={inv.receiptStatus ?? '—'} />
        <MiniFact label="订单金额" value={currency(inv.orderAmount)} />
      </div>
      {(inv.lineItems ?? []).length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-100">
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
  );

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
      ) : recv.isError ? (
        <FeedbackNotice tone="error" message="发票应收加载失败:登录态可能已过期,请重新登录后重试。" />
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
          <ResponsiveTableFrame
            mobileCards={pageItems.map((inv, i) => (
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                    <span className="font-mono text-sm font-black text-slate-900">{currency(inv.amount)}</span>
                  </div>
                </div>
                {expandedId === inv.id && <div className="mt-3">{renderExpanded(inv)}</div>}
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id ?? null)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  {expandedId === inv.id ? '收起' : '明细'}
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">发票号码</th>
                  <th className="px-5 py-4">关联订单</th>
                  <th className="px-5 py-4">到期日</th>
                  <th className="px-5 py-4">回款状态</th>
                  <th className="px-5 py-4 text-right">发票金额</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((inv, i) => (
                  <Fragment key={inv.id}>
                    <tr className={cn('hover:bg-blue-50/30', expandedId === inv.id && 'bg-blue-50/30')}>
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-mono text-xs font-black text-slate-900">{inv.invoiceNo ?? inv.id}</p>
                        {inv.overdue && (
                          <p className="mt-1 text-[11px] font-black text-red-600">已逾期 {inv.overdueDays} 天</p>
                        )}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{inv.orderId ?? '—'}</td>
                      <td className={cn('px-5 py-5 font-mono text-xs font-black', inv.overdue ? 'text-red-600' : 'text-slate-600')}>
                        {inv.dueDate ?? '—'}
                      </td>
                      <td className="px-5 py-5">{inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(inv.amount)}</td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id ?? null)}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          {expandedId === inv.id ? '收起' : '明细'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === inv.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={7} className="px-5 py-4">
                          {renderExpanded(inv)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
