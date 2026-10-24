import { Fragment, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import {
  type PurchaseOrderResponse,
  useSupplierDeliveryCreate,
  useSupplierDeliveryList,
  useSupplierInvoiceCreate,
  useSupplierOrderConfirm,
  useSupplierOrderList,
} from '@24bid/api-client';
import {
  FilterTabs,
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

type Batch = { id?: string; orderId?: string; trackingNo?: string; shippedQuantity?: number;
  lineItems?: { orderLineId?: string; shippedQuantity?: number }[] };

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 销售订单:供应商确认订单(待确认→待发货),并登记发货(承运商/运单/数量)与开票。
export function OrdersPage({ canConfirm = false, canShip = false, canInvoice = false }: {
  canConfirm?: boolean; canShip?: boolean; canInvoice?: boolean;
}) {
  const queryClient = useQueryClient();
  const orders = useSupplierOrderList();
  const confirm = useSupplierOrderConfirm();
  const ship = useSupplierDeliveryCreate();
  const deliveries = useSupplierDeliveryList();
  const issue = useSupplierInvoiceCreate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState<{ orderId: string; carrier: string; trackingNo: string; quantities: Record<string, string> } | null>(null);
  const [invForm, setInvForm] = useState<{
    orderId: string;
    invoiceNo: string;
    invoiceCode: string;
    taxRate: string;
  } | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = orders.isError ? [] : orders.data?.data ?? [];
  const batches = (deliveries.data?.data ?? []) as Batch[];
  const history = (id?: string) => batches.filter(d => d.orderId === id);
  const shippedLine = (id: string | undefined, lineId?: string) => history(id)
    .flatMap(d => d.lineItems ?? []).filter(l => l.orderLineId === lineId).reduce((sum, l) => sum + (l.shippedQuantity ?? 0), 0);
  const attributable = (o: PurchaseOrderResponse) => !deliveries.isError && !!deliveries.data
    && !!o.lineItems?.length && history(o.id).every(d => !!d.lineItems?.length
      && d.shippedQuantity === d.lineItems.reduce((s, l) => s + (l.shippedQuantity ?? 0), 0));
  const remaining = (o: PurchaseOrderResponse) => (o.lineItems ?? []).reduce((s, l) => s + Math.max(0, (l.quantity ?? 0) - shippedLine(o.id, l.id)), 0);
  const statuses = ['全部', ...Array.from(new Set(all.map((o) => o.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((o) => {
    if (statusFilter !== '全部' && o.status !== statusFilter) return false;
    if (!kw) return true;
    return [o.id, o.rfqId].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((o) => o.status === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/supplier\/(orders|deliveries|invoices|receivables)/.test(q.queryKey[0] as string),
    });

  const onIssueInvoice = (orderId: string, orderAmount?: number) => {
    const f = invForm?.orderId === orderId ? invForm : null;
    setFeedback(null);
    setError(null);
    if (!f || !canInvoice) return;
    const taxRate = f.taxRate.trim() === '' ? 13 : Number(f.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setError('税率应为 0 至 100 之间的数值。');
      return;
    }
    issue.mutate(
      {
        orderId,
        data: {
          amount: orderAmount ?? 0,
          invoiceNo: f.invoiceNo.trim(),
          invoiceCode: f?.invoiceCode || undefined,
          taxRate,
        },
      },
      {
        onSuccess: () => {
          setFeedback(`订单 ${orderId} 已开具发票`);
          setInvForm(null);
          refresh();
        },
        onError: reportError,
      },
    );
  };

  const reportError = (failure: unknown) => setError(
    (failure as { response?: { data?: { message?: string } } })?.response?.data?.message
      || '操作失败，请核对当前权限、订单状态和填写内容后重试。',
  );

  const onConfirm = (orderId: string) => {
    setFeedback(null);
    setError(null);
    if (!canConfirm) return;
    confirm.mutate({ orderId }, { onSuccess: () => { setFeedback(`订单 ${orderId} 已确认`); refresh(); }, onError: reportError });
  };

  const onShip = (orderId: string) => {
    const f = shipForm?.orderId === orderId ? shipForm : null;
    setFeedback(null);
    setError(null);
    if (!f || !canShip) return;
    const order = all.find(o => o.id === orderId);
    const entered = Object.entries(f.quantities).filter(([, value]) => value.trim() !== '');
    const lineItems = entered.map(([orderLineId, value]) => ({ orderLineId, shippedQuantity: Number(value) }));
    const quantity = lineItems.reduce((s, l) => s + l.shippedQuantity, 0);
    if (!order || !attributable(order) || !Number.isInteger(quantity) || quantity <= 0
      || lineItems.some(l => !Number.isFinite(l.shippedQuantity) || l.shippedQuantity <= 0)) {
      setError('发货数量应为正整数，不能填写零、负数或小数。');
      return;
    }
    if (lineItems.some(l => l.shippedQuantity > (order.lineItems?.find(ol => ol.id === l.orderLineId)?.quantity ?? 0) - shippedLine(orderId, l.orderLineId))) {
      setError('本批发货数量超过剩余可发数量。'); return;
    }
    ship.mutate(
      {
        orderId,
        data: {
          carrier: f.carrier.trim(),
          trackingNo: f.trackingNo.trim(),
          shippedQuantity: quantity,
          ...{ lineItems },
        },
      },
      { onSuccess: () => { setFeedback(`订单 ${orderId} 已登记发货`); setShipForm(null); refresh(); }, onError: reportError },
    );
  };

  // 展开区:行项明细 + 收货/付款信息 + 发货/开票表单(仅展开行渲染)。
  const renderExpanded = (o: PurchaseOrderResponse) => {
    const busyS = ship.isPending && ship.variables?.orderId === o.id;
    const busyI = issue.isPending && issue.variables?.orderId === o.id;
    const editing = shipForm?.orderId === o.id;
    const invEditing = invForm?.orderId === o.id;
    return (
      <div className="space-y-3">
        <p className="text-xs font-bold">剩余可发 {attributable(o) ? remaining(o) : '待核对'} · 已发累计 {history(o.id).reduce((s, d) => s + (d.shippedQuantity ?? 0), 0)}</p>
        {!attributable(o) && <FeedbackNotice tone="info" message="订单或历史批次缺少可核对行明细，暂停数量续办。" />}
        {history(o.id).map(d => <p key={d.id} className="break-words text-xs">{d.id} · {d.trackingNo} · 本批 {d.shippedQuantity ?? '待核对'}</p>)}
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniFact label="预计到货" value={o.expectedReceiptDate ?? '—'} />
          <MiniFact label="收货地址" value={o.deliveryAddress || '—'} />
          <MiniFact label="付款方式" value={o.paymentTerms ?? '—'} />
        </div>

        {(o.lineItems ?? []).length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
              订单行项明细（{(o.lineItems ?? []).length} 项）
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
                {(o.lineItems ?? []).map((l) => (
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

        {canShip && editing && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <p className="text-xs font-black text-blue-800">发货登记</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input className={inputCls} placeholder="承运商" value={shipForm!.carrier}
                onChange={(e) => setShipForm({ ...shipForm!, carrier: e.target.value })} />
              <input className={inputCls} placeholder="运单号" value={shipForm!.trackingNo}
                onChange={(e) => setShipForm({ ...shipForm!, trackingNo: e.target.value })} />
            </div>
            {(o.lineItems ?? []).map(l => <label key={l.id} className="mt-2 block text-xs">
              {l.description} · 剩余可发 {Math.max(0, (l.quantity ?? 0) - shippedLine(o.id, l.id))}
              <input className={inputCls} type="number" min="0.0001" step="0.0001" placeholder="发货数量" aria-label={`${l.description}本批发货数量`}
                value={shipForm!.quantities[l.id!] ?? ''}
                onChange={e => setShipForm({ ...shipForm!, quantities: { ...shipForm!.quantities, [l.id!]: e.target.value } })} />
            </label>)}
            <div className="mt-2 flex gap-2">
              <PrimaryActionButton
                onClick={() => onShip(o.id!)}
                busy={busyS}
                pendingLabel="提交中"
                disabled={!shipForm?.carrier?.trim() || !shipForm?.trackingNo?.trim()}
              >
                提交发货
              </PrimaryActionButton>
              <button type="button" onClick={() => setShipForm(null)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
                取消
              </button>
            </div>
          </div>
        )}

        {canInvoice && invEditing && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <p className="text-xs font-black text-blue-800">开具发票(金额须与订单一致 {currency(o.amount)})</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input className={inputCls} placeholder="发票号码" value={invForm!.invoiceNo}
                onChange={(e) => setInvForm({ ...invForm!, invoiceNo: e.target.value })} />
              <input className={inputCls} placeholder="发票代码" value={invForm!.invoiceCode}
                onChange={(e) => setInvForm({ ...invForm!, invoiceCode: e.target.value })} />
              <input className={inputCls} type="number" min="0" max="100" step="0.01" placeholder="税率%" value={invForm!.taxRate}
                onChange={(e) => setInvForm({ ...invForm!, taxRate: e.target.value })} />
            </div>
            <div className="mt-2 flex gap-2">
              <PrimaryActionButton
                onClick={() => onIssueInvoice(o.id!, o.amount)}
                busy={busyI}
                pendingLabel="开票中"
                disabled={!invForm?.invoiceNo?.trim()}
              >
                提交开票
              </PrimaryActionButton>
              <button type="button" onClick={() => setInvForm(null)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 操作按钮组(表格行与移动卡片共用)。
  const rowActions = (o: PurchaseOrderResponse) => {
    const busyC = confirm.isPending && confirm.variables?.orderId === o.id;
    const expanded = expandedId === o.id;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canConfirm && o.status === '待供应商确认' && o.id && (
          <button
            type="button"
            disabled={busyC}
            onClick={() => onConfirm(o.id!)}
            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
          >
            {busyC ? '确认中' : '确认订单'}
          </button>
        )}
        {canShip && (o.status === '待发货' || o.status === '已发货') && o.id && attributable(o) && remaining(o) > 0 && (
          <button
            type="button"
            onClick={() => {
              setShipForm({ orderId: o.id!, carrier: '', trackingNo: '', quantities: {} });
              setInvForm(null);
              setExpandedId(o.id!);
            }}
            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
          >
            {o.status === '已发货' ? '继续发货' : '登记发货'}
          </button>
        )}
        {canInvoice && o.status === '已收货' && o.id && (
          <button
            type="button"
            onClick={() => {
              setInvForm({ orderId: o.id!, invoiceNo: '', invoiceCode: '', taxRate: '13' });
              setShipForm(null);
              setExpandedId(o.id!);
            }}
            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
          >
            开具发票
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpandedId(expanded ? null : o.id ?? null)}
          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
        >
          {expanded ? '收起' : '明细'}
        </button>
      </div>
    );
  };

  return (
    <Panel title="销售订单" icon={ShoppingCart} subtitle="订单确认 · 发货登记 · 开票">
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
          placeholder="按订单号 / 询比号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {error && <FeedbackNotice tone="error" message={error} />}
      {orders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载销售订单…" />
      ) : orders.isError ? (
        <FeedbackNotice tone="error" message="订单加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的订单。'
              : '暂无销售订单。采购方定标生成订单后出现在此。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((o, i) => (
              <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {o.id}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">询比 {o.rfqId ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {o.status && <StatusPill label={o.status} />}
                    <span className="font-mono text-sm font-black text-slate-900">{currency(o.amount)}</span>
                  </div>
                </div>
                <div className="mt-3">{rowActions(o)}</div>
                {expandedId === o.id && <div className="mt-3">{renderExpanded(o)}</div>}
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">订单编号</th>
                  <th className="px-5 py-4">预计到货</th>
                  <th className="px-5 py-4">付款方式</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">订单金额</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((o, i) => (
                  <Fragment key={o.id}>
                    <tr className={cn('hover:bg-blue-50/30', expandedId === o.id && 'bg-blue-50/30')}>
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-mono text-xs font-black text-slate-900">{o.id}</p>
                        <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">询比 {o.rfqId ?? '—'}</p>
                      </td>
                      <td className="px-5 py-5 text-sm font-bold text-slate-600">{o.expectedReceiptDate ?? '—'}</td>
                      <td className="px-5 py-5 text-sm font-bold text-slate-600">{o.paymentTerms ?? '—'}</td>
                      <td className="px-5 py-5">{o.status && <StatusPill label={o.status} />}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(o.amount)}</td>
                      <td className="px-5 py-5 text-right">{rowActions(o)}</td>
                    </tr>
                    {expandedId === o.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={7} className="px-5 py-4">
                          {renderExpanded(o)}
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
