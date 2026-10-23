import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { getSupplierExitItems, isSupplierExitItemsPage, supplierExitItemsKey, SUPPLIER_EXIT_ITEMS_PAGE_SIZE,
  type SupplierExitItem, type SupplierExitItemKind } from '@24bid/api-client';
import { FeedbackNotice, Pagination, ResponsiveTableFrame, StatusPill } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const money = (value: number | null) => value === null ? '待核对' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function SupplierExitItems({ relationId, kind, expected }: { relationId?: string; kind: SupplierExitItemKind; expected: number }) {
  const { can } = useBuyerPermissions();
  const orderKind = kind === 'uninvoiced';
  const allowed = can(orderKind ? 'buyer:order:read' : 'buyer:invoice:read');
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: supplierExitItemsKey(relationId ?? '', kind, page), enabled: !!relationId && allowed,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await getSupplierExitItems(relationId!, kind, page, signal);
      if (!isSupplierExitItemsPage(response.data, page)) throw new Error('异常明细响应不完整');
      return response.data;
    },
  });
  const denied = (query.error as { response?: { status?: number } } | null)?.response?.status === 403;
  const data = query.data;
  const maxPage = Math.max(1, Math.ceil((data?.total ?? 0) / SUPPLIER_EXIT_ITEMS_PAGE_SIZE));
  const amounts = (row: SupplierExitItem) => <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
    <div><dt className="text-slate-500">{orderKind ? '订单金额' : '发票金额'}</dt><dd className="break-all tabular-nums">{money(row.amount)}</dd></div>
    <div><dt className="text-slate-500">{orderKind ? '已开票金额' : '已付款金额'}</dt><dd className="break-all tabular-nums">{money(orderKind ? row.invoicedAmount : row.paidAmount)}</dd></div>
    <div className="col-span-2"><dt className="text-slate-500">{orderKind ? '未开票金额' : '剩余金额'}</dt><dd className="break-all tabular-nums">{money(row.remainingAmount)}</dd></div>
  </dl>;
  const link = (row: SupplierExitItem) => {
    const recordId = orderKind ? row.orderId : row.invoiceId;
    return recordId ? <a target="_blank" rel="noopener noreferrer"
      href={`/?${new URLSearchParams({ module: orderKind ? 'orders' : 'invoices', recordId })}`}
      aria-label={`查看${row.label}详情（新窗口）`} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-bold text-blue-700">
      详情 <ExternalLink size={12} /></a> : null;
  };
  return <section aria-label={orderKind ? '未足额开票明细' : '付款待核对明细'} className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">处理后刷新明细，并重新核查退出条件。</p>
      {allowed && relationId && <button type="button" aria-label="刷新异常明细" title="刷新异常明细" disabled={query.isFetching}
        onClick={() => void query.refetch()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 disabled:opacity-50"><RefreshCw size={16} /></button>}
    </div>
    {!allowed || denied ? <FeedbackNotice tone="info" message={orderKind ? '无订单查看权限，请联系采购负责人核对未足额开票订单。' : '无发票查看权限，请联系财务岗位核对付款记录。'} />
      : !relationId ? <FeedbackNotice tone="error" message="缺少供应商关系，无法读取异常明细，请重新打开供应商。" />
      : query.isError ? <FeedbackNotice tone="error" message="异常明细加载失败，请刷新重试；当前不能据此解除退出限制。" />
      : query.isPending ? <FeedbackNotice tone="info" message="正在读取异常明细…" />
      : data && <>
        {data.total !== expected && <FeedbackNotice tone="info" message="可见明细与上次核查数量不同，可能存在数据权限限制或业务状态变化；请重新核查退出条件。" />}
        {data.items.length === 0 ? <p className="py-3 text-sm text-slate-500">暂无可见异常明细；退出条件仍以重新核查结果为准。</p> :
          <ResponsiveTableFrame mobileCards={data.items.map(row => <div key={row.id} className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3">
            <p className="break-all text-sm font-bold">{row.label}</p><StatusPill label={row.status} />
            <p className="break-words text-sm">{row.reason}</p>{amounts(row)}
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words text-xs">处理岗位：<span>{row.handlerLabel}</span></p>{link(row)}</div>
          </div>)}>
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="w-1/5 px-3 py-3">业务标识 / 状态</th><th className="px-3">异常原因</th><th className="w-1/4 px-3">金额</th><th className="w-28 px-3">处理岗位</th><th className="w-24 px-3">操作</th></tr></thead>
              <tbody>{data.items.map(row => <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="space-y-2 break-all px-3 py-3"><p className="font-semibold">{row.label}</p><StatusPill label={row.status} /></td>
                <td className="break-words px-3 py-3">{row.reason}</td><td className="px-3 py-3">{amounts(row)}</td>
                <td className="break-words px-3 py-3">{row.handlerLabel}</td><td className="px-3 py-3">{link(row)}</td>
              </tr>)}</tbody>
            </table>
          </ResponsiveTableFrame>}
        {page > maxPage ? <button type="button" onClick={() => setPage(maxPage)} className="min-h-9 rounded-md border border-slate-200 px-3 text-sm">当前页已无记录，返回第 {maxPage} 页</button>
          : <Pagination page={page} pageSize={SUPPLIER_EXIT_ITEMS_PAGE_SIZE} total={data.total} onPageChange={setPage} />}
      </>}
  </section>;
}
