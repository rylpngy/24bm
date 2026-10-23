import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { usePurchaseOrderList, useBuyerPaymentList } from '@24bid/api-client';
import { FeedbackNotice, Pagination, ResponsiveTableFrame, StatusPill } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

type Row = { id: string; label: string; status: string; amount?: number };
const money = (value?: number) => value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

export function SupplierUnsettledBusiness({ supplierId, orderCount, invoiceCount }: {
  supplierId: string; orderCount: number; invoiceCount: number;
}) {
  const { can } = useBuyerPermissions();
  const canOrders = can('buyer:order:read');
  const canInvoices = can('buyer:invoice:read');
  const orders = usePurchaseOrderList({ supplierId }, { query: { enabled: !!supplierId && canOrders } });
  const invoices = useBuyerPaymentList({ supplierId }, { query: { enabled: !!supplierId && canInvoices } });
  const [tab, setTab] = useState<'orders' | 'invoices'>(orderCount ? 'orders' : 'invoices');
  const [page, setPage] = useState(1);
  const query = tab === 'orders' ? orders : invoices;
  const allowed = tab === 'orders' ? canOrders : canInvoices;
  const expected = tab === 'orders' ? orderCount : invoiceCount;
  const rows: Row[] = tab === 'orders'
    ? (orders.data?.data ?? []).filter(r => r.supplierId === supplierId && r.status !== '已收货').map(r => ({ id: r.id ?? '', label: r.id ?? '—', status: r.status ?? '—', amount: r.amount }))
    : (invoices.data?.data ?? []).filter(r => r.supplierId === supplierId && r.paymentStatus !== '已付款').map(r => ({ id: r.id ?? '', label: r.invoiceNo || r.id || '—', status: r.paymentStatus ?? '—', amount: r.amount }));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 5)));
  const visible = rows.slice((safePage - 1) * 5, safePage * 5);
  const link = (row: Row) => row.id ? <a target="_blank" rel="noopener noreferrer"
    href={`/?${new URLSearchParams({ module: tab, recordId: row.id })}`}
    aria-label={`查看${row.label}详情（新窗口）`}
    className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50">
    详情 <ExternalLink size={12} />
  </a> : null;

  return <section aria-label="退出前未结业务" className="min-w-0 space-y-3 border-t border-slate-200 pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="未结业务类型" className="flex flex-wrap gap-1">
        {([['orders', '未收货订单', orderCount], ['invoices', '未付清发票', invoiceCount]] as const).map(([key, label, count]) =>
          <button key={key} type="button" role="tab" aria-selected={tab === key}
            onClick={() => { setTab(key); setPage(1); }}
            className={`h-9 whitespace-nowrap rounded-md px-3 text-sm font-bold ${tab === key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            {label} {count}
          </button>)}
      </div>
      {allowed && <button type="button" aria-label="刷新未结业务明细" title="刷新未结业务明细" disabled={query.isFetching}
        onClick={() => void query.refetch()} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-50">
        <RefreshCw size={16} />
      </button>}
    </div>
    {!allowed ? <FeedbackNotice tone="info" message={tab === 'orders' ? '无订单查看权限，请联系采购负责人处理未结订单。' : '无发票查看权限，请联系财务人员处理未付清发票。'} />
      : query.isError ? <FeedbackNotice tone="error" message="未结业务明细加载失败，请重试；当前仍不能申请退出。" />
      : query.isLoading ? <FeedbackNotice tone="info" message="正在读取未结业务…" />
      : <>
        {rows.length !== expected && <FeedbackNotice tone="info" message="可见明细与上次核查数量不同，可能存在数据权限限制或业务状态变化；处理后请重新核查退出条件。" />}
        {tab === 'invoices' && <p className="text-xs text-slate-500">以下为发票票面金额，不代表剩余应付余额。</p>}
        {rows.length === 0 ? <p className="py-3 text-sm text-slate-500">暂无可见未结明细。</p> : <>
          <ResponsiveTableFrame mobileCards={visible.map(row => <div key={row.id} className="min-w-0 rounded-lg border border-slate-200 p-3">
            <p className="break-all text-sm font-bold text-slate-800">{row.label}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><StatusPill label={row.status} /><span className="text-sm">{money(row.amount)}</span>{link(row)}</div>
          </div>)}>
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="w-16 whitespace-nowrap px-3 py-3">序号</th><th className="px-3">{tab === 'orders' ? '订单编号' : '发票号码'}</th><th className="w-28 px-3">状态</th><th className="w-36 px-3">{tab === 'orders' ? '订单金额' : '票面金额'}</th><th className="w-24 px-3">操作</th></tr></thead>
              <tbody>{visible.map((row, index) => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-3 text-slate-400">{(safePage - 1) * 5 + index + 1}</td><td className="truncate px-3 font-semibold" title={row.label}>{row.label}</td><td className="px-3"><StatusPill label={row.status} /></td><td className="px-3 tabular-nums">{money(row.amount)}</td><td className="px-3">{link(row)}</td></tr>)}</tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={5} total={rows.length} onPageChange={setPage} />
        </>}
      </>}
  </section>;
}
