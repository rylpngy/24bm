import { useState } from 'react';
import { Check, History, PackageCheck, RefreshCw, Truck, Undo2 } from 'lucide-react';
import {
  axiosInstance,
  type MallAfterSalesResponse,
  type PurchaseOrderResponse,
  useBuyerDeliveryList,
  useBuyerReceiptList,
  useBuyerReceiptCreate,
  useBuyerMallAfterSales,
  useBuyerMallApplyAfterSales,
  useBuyerMallReviews,
  useBuyerMallSubmitReview,
  usePurchaseOrderList,
} from '@24bid/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMallPermissions } from '../../lib/use-mall-permissions';
import { FeedbackNotice, Pagination, PrimaryActionButton, StatusPill, cn } from '@24bid/ui';
import { currency } from '../catalog/product-card';

const PAGE_SIZE = 8;
const field = 'min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm';
const button = 'inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50';
const afterSalesRoot = '/api/v1/buyer/mall/after-sales';
const validQuantity = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));
function errorText(error: unknown) {
  const body = (error as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data;
  return body?.message ?? body?.error?.message ?? '操作失败，请刷新后重试';
}

interface ServiceEvent {
  id: string; actorId?: string; actorName?: string; actorRole: string; fromStatus?: string; toStatus: string;
  note?: string; evidenceNo?: string; createdAt: string;
}

function CheckoutNote({ orderId }: { orderId?: string }) {
  const path = `/api/v1/buyer/mall/orders/${encodeURIComponent(orderId ?? '')}/checkout-note`;
  const query = useQuery({ queryKey: [path], enabled: !!orderId,
    queryFn: async ({ signal }) => (await axiosInstance.get<{ data: string | null }>(path, { signal })).data.data });
  if (!orderId) return null;
  return <section aria-label="结算备注" className="mb-3 space-y-1 border-b border-slate-100 pb-3 text-xs">
    <h2 className="font-bold text-slate-700">结算备注</h2>
    {query.isError ? <div role="alert"><p>结算备注加载失败</p><button className={button} onClick={() => void query.refetch()}>重试备注</button></div>
      : query.isPending ? <p role="status">正在加载结算备注…</p>
        : <p className="whitespace-pre-wrap break-words text-slate-600">{query.data?.trim() ? query.data : '未填写结算备注'}</p>}
  </section>;
}

function AfterSalesCase({ row, canPurchase, refresh }: {
  row: MallAfterSalesResponse & { financialStatus?: string }; canPurchase: boolean; refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const history = useQuery({ queryKey: [afterSalesRoot, row.id, 'history'], enabled: open && !!row.id,
    queryFn: async ({ signal }) => (await axiosInstance.get<{ data: ServiceEvent[] }>(`${afterSalesRoot}/${encodeURIComponent(row.id!)}/history`, { signal })).data.data });
  const action = useMutation({ mutationFn: async (target: 'confirm' | 'withdraw') => {
    await axiosInstance.post(`${afterSalesRoot}/${encodeURIComponent(row.id!)}/${target}`, { note: note.trim() });
  }, onSuccess: async () => { setError(''); await refresh(); setNote(''); }, onError: cause => setError(errorText(cause)) });
  const act = (target: 'confirm' | 'withdraw') => {
    if (action.isPending || !row.id || !canPurchase) return;
    if (!note.trim()) { setError('请填写确认或撤回说明'); return; }
    setError(''); action.mutate(target);
  };
  const financial = row.financialStatus ?? (['已拒绝', '已撤回'].includes(row.status ?? '') ? '无售后阻塞'
    : row.status === '已完成' ? (row.type === '退货' ? '退货财务待核对，非银行退款凭证' : '无售后阻塞') : '售后未决，暂停付款及归档');
  return <div className="mt-2 space-y-2 border-t border-slate-200 py-2 text-xs">
    <p className="break-words font-bold text-amber-800">售后 · {row.type} · {row.quantity} · {row.status}</p>
    <p className="break-words">{row.reason}</p>
    {row.supplierReply && <p className="break-words">处理回复：{row.supplierReply}</p>}
    <p className="break-words text-amber-800">{financial}</p>
    {canPurchase && row.id && ['待处理', '待买方确认'].includes(row.status ?? '') && <div className="flex flex-wrap items-center gap-2">
      <textarea aria-label={`确认或撤回说明 ${row.id}`} className={`${field} w-full`} value={note} disabled={action.isPending} onChange={e => setNote(e.target.value)} />
      {row.status === '待买方确认' ? <button className={button} disabled={action.isPending} onClick={() => act('confirm')}><Check size={14} />确认处理结果</button>
        : <button className={button} disabled={action.isPending} onClick={() => act('withdraw')}><Undo2 size={14} />撤回申请</button>}
    </div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {row.id && <button className={button} aria-expanded={open} onClick={() => setOpen(!open)}><History size={14} />办理历史</button>}
    {open && (history.isError ? <p role="alert">历史加载失败 <button className={button} onClick={() => void history.refetch()}>重试</button></p>
      : history.isPending ? <p role="status">加载历史中</p> : <ol className="space-y-2">
        {history.data?.length === 0 && <li>暂无办理历史</li>}
        {history.data?.map(event => <li key={event.id} className="break-words"><time>{event.createdAt}</time> · {event.actorRole === 'buyer' ? '采购方' : '供应商'} · {event.fromStatus ?? '申请'} → {event.toStatus}
          <p className="break-all">办理人：{event.actorName?.trim() || (event.actorId?.trim() ? `ID: ${event.actorId}` : '未记录办理人')}</p>
          {event.note && <p>{event.note}</p>}{event.evidenceNo && <p>凭据：{event.evidenceNo}</p>}</li>)}
      </ol>)}
  </div>;
}

function OrderFulfillment({ order, canReadReceipts, canReceive }: {
  order: PurchaseOrderResponse; canReadReceipts: boolean; canReceive: boolean;
}) {
  const client = useQueryClient();
  const deliveries = useBuyerDeliveryList();
  const receipts = useBuyerReceiptList({ orderId: order.id }, { query: { enabled: canReadReceipts && !!order.id } });
  const receive = useBuyerReceiptCreate();
  const [draft, setDraft] = useState<Record<string, { received: string; qualified: string }>>({});
  const [note, setNote] = useState('');
  const [disposition, setDisposition] = useState('退货换货');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const shipments = (deliveries.isError ? [] : deliveries.data?.data ?? []).filter(d => d.orderId === order.id);
  const history = (receipts.isError ? [] : receipts.data?.data ?? []).filter(r => r.orderId === order.id);
  const lines = order.lineItems ?? [];
  const knownLine = (id?: string) => !!id && lines.some(l => l.id === id);
  const nonnegative = (value?: number) => value != null && Number.isFinite(value) && value >= 0;
  const evidenceReady = !!deliveries.data && !!receipts.data && !deliveries.isError && !receipts.isError
    && lines.length > 0 && lines.every(l => l.id && nonnegative(l.quantity)) && shipments.length > 0
    && shipments.every(d => !!d.lineItems?.length
      && d.lineItems.every(l => knownLine(l.orderLineId) && nonnegative(l.shippedQuantity))
      && Math.abs((d.shippedQuantity ?? NaN) - d.lineItems.reduce((sum, l) => sum + (l.shippedQuantity ?? 0), 0)) < 0.001)
    && history.every(r => !!r.lineItems?.length
      && r.lineItems.every(l => knownLine(l.orderLineId) && nonnegative(l.receivedQuantity) && nonnegative(l.qualifiedQuantity) && l.qualifiedQuantity! <= l.receivedQuantity!)
      && Math.abs((r.receivedQuantity ?? NaN) - r.lineItems.reduce((sum, l) => sum + (l.receivedQuantity ?? 0), 0)) < 0.001
      && Math.abs((r.qualifiedQuantity ?? NaN) - r.lineItems.reduce((sum, l) => sum + (l.qualifiedQuantity ?? 0), 0)) < 0.001);
  const remaining = (lineId: string) => Math.round((shipments.flatMap(d => d.lineItems ?? []).filter(l => l.orderLineId === lineId).reduce((sum, l) => sum + (l.shippedQuantity ?? 0), 0)
    - history.flatMap(r => r.lineItems ?? []).filter(l => l.orderLineId === lineId).reduce((sum, l) => sum + (l.receivedQuantity ?? 0), 0)) * 100) / 100;
  const receivable = evidenceReady && lines.every(l => remaining(l.id!) >= 0 && remaining(l.id!) <= l.quantity!)
    && lines.some(l => remaining(l.id!) > 0);
  const submit = () => {
    setError(''); setSaved(false);
    if (!canReadReceipts || !canReceive || !receivable || receive.isPending || order.status !== '已发货' || !order.id) return;
    const lineItems = lines.map(line => {
      const entry = draft[line.id!] ?? { received: '0', qualified: '0' };
      if (!validQuantity(entry.received) || !validQuantity(entry.qualified) || Number(entry.received) > remaining(line.id!) || Number(entry.qualified) > Number(entry.received)) {
        throw new Error('请核对本次收货与合格数量，不得超过待收数量');
      }
      return { orderLineId: line.id!, receivedQuantity: Number(entry.received), qualifiedQuantity: Number(entry.qualified) };
    }).filter(l => l.receivedQuantity > 0);
    if (!lineItems.length) { setError('请填写本次实际收货数量'); return; }
    const receivedQuantity = Math.round(lineItems.reduce((sum, l) => sum + l.receivedQuantity, 0) * 100) / 100;
    const qualifiedQuantity = Math.round(lineItems.reduce((sum, l) => sum + l.qualifiedQuantity, 0) * 100) / 100;
    const defect = qualifiedQuantity < receivedQuantity;
    if (defect && !note.trim()) { setError('存在不合格数量，请填写验收及处置说明'); return; }
    receive.mutate({ orderId: order.id, data: {
      result: defect ? '部分合格' : '验收合格', receivedQuantity, qualifiedQuantity, lineItems,
      qualityNote: note.trim(), ...(defect ? { disposition, dispositionNote: note.trim() } : {}),
    } }, { onSuccess: async () => {
      await client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('/buyer/') });
      setDraft({}); setNote(''); setSaved(true);
    }, onError: cause => setError(errorText(cause)) });
  };
  return <section aria-label="物流与收货" className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs">
    <h2 className="flex items-center gap-2 font-bold"><Truck size={14} />物流与收货</h2>
    {deliveries.isError ? <p role="alert">物流加载失败 <button className={button} onClick={() => void deliveries.refetch()}>刷新物流</button></p>
      : deliveries.isPending ? <p>正在加载物流…</p> : shipments.length === 0 ? <p>暂无发货记录</p> : shipments.map(d => <p key={d.id} className="break-words">{d.carrier || '未填写承运方'} · {d.trackingNo || '未填写运单号'} · 发货 {d.shippedQuantity ?? '待核对'} · {d.status} {d.shippedDate} {d.estimatedArrival && `预计到货 ${d.estimatedArrival}`} {d.logisticsNote}</p>)}
    {canReadReceipts && (receipts.isError ? <p role="alert">收货记录加载失败 <button className={button} onClick={() => void receipts.refetch()}>刷新收货</button></p>
      : receipts.isPending ? <p>正在加载收货记录…</p> : history.map(r => <p key={r.id} className="break-words">收货 {r.receivedQuantity} · 合格 {r.qualifiedQuantity} · {r.result} · {r.receivedAt} {r.qualityNote} {r.disposition} {r.dispositionNote}</p>))}
    {canReadReceipts && canReceive && order.status === '已发货' && (receivable ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); try { submit(); } catch (cause) { setError((cause as Error).message); } }}>
      {lines.map(line => {
        const entry = draft[line.id!] ?? { received: '0', qualified: '0' };
        return <fieldset key={line.id} className="flex min-w-0 flex-wrap gap-2" disabled={receive.isPending}><legend className="mb-1 break-words font-bold">{line.description} · 待收 {remaining(line.id!)}{line.unit}</legend>
          <label>本次收货<input aria-label={`本次收货 ${line.description}`} className={`${field} ml-2 w-24`} type="number" min="0" step="0.01" max={remaining(line.id!)} value={entry.received} onChange={e => setDraft(old => ({ ...old, [line.id!]: { ...entry, received: e.target.value } }))} /></label>
          <label>本次合格<input aria-label={`本次合格 ${line.description}`} className={`${field} ml-2 w-24`} type="number" min="0" step="0.01" max={Number(entry.received)} value={entry.qualified} onChange={e => setDraft(old => ({ ...old, [line.id!]: { ...entry, qualified: e.target.value } }))} /></label>
        </fieldset>;
      })}
      <label className="block">不合格处置<select className={`${field} ml-2`} disabled={receive.isPending} value={disposition} onChange={e => setDisposition(e.target.value)}>{['退货换货', '让步接收'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block">验收及处置说明<textarea className={`${field} mt-1 w-full`} disabled={receive.isPending} value={note} onChange={e => setNote(e.target.value)} /></label>
      <button className={button} type="submit" disabled={receive.isPending}><PackageCheck size={14} />{receive.isPending ? '登记中…' : '登记收货'}</button>
    </form> : <p className="text-amber-800">暂无可核对的待收明细；历史或缺失的发货、收货证据请在采购工作台核对后办理。</p>)}
    {error && <p role="alert" className="text-red-700">{error}</p>}{saved && <p role="status" className="text-emerald-700">收货记录已保存</p>}
  </section>;
}

/**
 * 我的订单:只列商城渠道的订单(sourceMethod=商城)。
 *
 * Reuses the existing fulfillment and aftersales APIs; never infers acceptance or refunds.
 */
export function MallOrdersPage() {
  const { can } = useMallPermissions();
  const queryClient = useQueryClient();
  const orders = usePurchaseOrderList();
  const afterSales = useBuyerMallAfterSales();
  const reviews = useBuyerMallReviews();
  const applyAfterSales = useBuyerMallApplyAfterSales();
  const submitReview = useBuyerMallSubmitReview();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  // 每行独立的售后草稿与评分草稿:同一订单可能多行,共享状态会串。
  const [asDraft, setAsDraft] = useState<Record<string, { type: string; reason: string; quantity: string }>>({});
  const [reviewDraft, setReviewDraft] = useState<Record<string, { rating: number; content: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string'
        && (q.queryKey[0] as string).includes('/buyer/'),
    });
  const reportError = (e: unknown) =>
    setError(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? '操作失败,请稍后重试',
    );
  const lineAfterSales = (orderId?: string, lineId?: string) =>
    (afterSales.data?.data ?? []).filter((a) => a.orderId === orderId && a.orderLineId === lineId);
  const lineReview = (lineId?: string) =>
    (reviews.data?.data ?? []).find((r) => r.orderLineId === lineId);

  // 按下单时间倒序:刚下的单必须在第一页第一条,否则用户下完单看不到自己的订单。
  const mallOrders = (orders.data?.data ?? [])
    .filter((o) => o.sourceMethod === '商城')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const pageCount = Math.max(1, Math.ceil(mallOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = mallOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (orders.isLoading || afterSales.isLoading || reviews.isLoading) {
    return <FeedbackNotice tone="info" message="正在加载订单…" />;
  }
  if (orders.isError || afterSales.isError || reviews.isError) {
    return <div className="space-y-2"><FeedbackNotice tone="error" message="订单或售后信息加载失败，请刷新重试。" /><button className={button} onClick={() => void refresh()}><RefreshCw size={14} />刷新订单</button></div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-slate-950">
        我的订单
        <span className="ml-2 text-sm font-bold text-slate-400">{mallOrders.length} 张</span>
      </h1>

      {mallOrders.length === 0 ? (
        <FeedbackNotice tone="info" message="还没有商城订单。挑选商品下单后在这里跟踪履约。" />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50"
              >
                <button
                  type="button"
                  onClick={() => setExpanded((cur) => (cur === order.id ? null : order.id ?? null))}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-bold text-slate-500">{order.id}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      下单 {order.createdAt?.slice(0, 10)} · 预计到货 {order.expectedReceiptDate}
                    </p>
                  </div>
                  {order.status && <StatusPill label={order.status} />}
                  <span className="font-mono text-base font-black text-slate-900">
                    {currency(order.amount)}
                  </span>
                </button>

                {expanded === order.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {error && <div className="mb-2"><FeedbackNotice tone="error" message={error} /></div>}
                    <CheckoutNote orderId={order.id} />
                    <ul className="space-y-2">
                      {(order.lineItems ?? []).map((line, index) => {
                        const canAfterSales = can('buyer:mall:purchase') && !!order.id && !!line.id && ['已发货', '已收货'].includes(order.status ?? '');
                        const canReview = can('buyer:mall:purchase') && order.status === '已收货';
                        const claims = lineAfterSales(order.id, line.id);
                        const remaining = Math.max(0, Math.round(((line.quantity ?? 0) - claims.filter(a => !['已拒绝', '已撤回'].includes(a.status ?? '')).reduce((total, a) => total + (a.quantity ?? 0), 0)) * 100) / 100);
                        const existingReview = lineReview(line.id);
                        const draft = asDraft[line.id ?? ''] ?? { type: '退货', reason: '', quantity: String(Math.min(1, remaining)) };
                        const rd = reviewDraft[line.id ?? ''] ?? { rating: 5, content: '' };
                        return (
                          <li key={`${order.id}-${index}`} className="rounded-md bg-slate-50/60 px-2.5 py-2">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span className="truncate">
                                {line.description} × {line.quantity}{line.unit}
                              </span>
                              <span className="font-mono">{currency(line.lineAmount)}</span>
                            </div>

                            {claims.map(row => <AfterSalesCase key={row.id} row={row} canPurchase={can('buyer:mall:purchase')} refresh={refresh} />)}
                            {existingReview && (
                              <p className="mt-1 text-[11px] font-bold text-emerald-700">
                                已评价 {'★'.repeat(existingReview.rating ?? 0)}
                                {existingReview.content ? ` · ${existingReview.content}` : ''}
                              </p>
                            )}

                            {canAfterSales && remaining > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <label className="text-xs">售后数量（剩余 {remaining}{line.unit}）<input
                                  aria-label={`售后数量 ${line.description}`} className={`${field} ml-2 w-24`} type="number" min="0.01" max={remaining} step="0.01"
                                  value={draft.quantity} disabled={applyAfterSales.isPending}
                                  onChange={e => setAsDraft(c => ({ ...c, [line.id!]: { ...draft, quantity: e.target.value } }))} /></label>
                                <select
                                  aria-label={`售后类型 ${line.description}`}
                                  className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700"
                                  value={draft.type}
                                  onChange={(e) =>
                                    setAsDraft((c) => ({ ...c, [line.id ?? '']: { ...draft, type: e.target.value } }))
                                  }
                                >
                                  {['退货', '换货', '维修'].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input
                                  aria-label={`售后原因 ${line.description}`}
                                  className="h-8 min-w-40 flex-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                                  placeholder="售后原因(必填)"
                                  value={draft.reason}
                                  onChange={(e) =>
                                    setAsDraft((c) => ({ ...c, [line.id ?? '']: { ...draft, reason: e.target.value } }))
                                  }
                                />
                                <PrimaryActionButton
                                  size="sm"
                                  busy={applyAfterSales.isPending}
                                  pendingLabel="提交中"
                                  disabled={!draft.reason.trim() || !validQuantity(draft.quantity) || Number(draft.quantity) <= 0 || Number(draft.quantity) > remaining}
                                  onClick={() => {
                                    setError(null);
                                    if (applyAfterSales.isPending || !validQuantity(draft.quantity) || Number(draft.quantity) <= 0 || Number(draft.quantity) > remaining || !draft.reason.trim()) return;
                                    order.id && line.id && applyAfterSales.mutate(
                                      {
                                        data: {
                                          orderId: order.id,
                                          orderLineId: line.id,
                                          type: draft.type,
                                          quantity: Number(draft.quantity),
                                          reason: draft.reason.trim(),
                                        },
                                      },
                                      { onSuccess: async () => { await refresh(); setAsDraft(c => { const next = { ...c }; delete next[line.id!]; return next; }); }, onError: reportError },
                                    );
                                  }}
                                >
                                  申请售后
                                </PrimaryActionButton>
                              </div>
                            )}

                            {canReview && !existingReview && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      aria-label={`${line.description} 评 ${star} 星`}
                                      onClick={() =>
                                        setReviewDraft((c) => ({ ...c, [line.id ?? '']: { ...rd, rating: star } }))
                                      }
                                      className={cn(
                                        'text-base leading-none',
                                        star <= rd.rating ? 'text-amber-500' : 'text-slate-300',
                                      )}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </span>
                                <input
                                  aria-label={`评价内容 ${line.description}`}
                                  className="h-8 min-w-40 flex-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                                  placeholder="评价内容(选填)"
                                  value={rd.content}
                                  onChange={(e) =>
                                    setReviewDraft((c) => ({ ...c, [line.id ?? '']: { ...rd, content: e.target.value } }))
                                  }
                                />
                                <PrimaryActionButton
                                  size="sm"
                                  busy={submitReview.isPending}
                                  pendingLabel="提交中"
                                  onClick={() => {
                                    setError(null);
                                    order.id && line.id && submitReview.mutate(
                                      {
                                        data: {
                                          orderId: order.id,
                                          orderLineId: line.id,
                                          rating: rd.rating,
                                          content: rd.content.trim(),
                                        },
                                      },
                                      { onSuccess: refresh, onError: reportError },
                                    );
                                  }}
                                >
                                  提交评价
                                </PrimaryActionButton>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <div className={cn(
                      'mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-600',
                      'sm:grid-cols-2',
                    )}>
                      <p className="flex items-center gap-1.5">
                        <Truck size={13} className="text-blue-600" />
                        {order.deliveryAddress
                          ? `${order.contactName}(${order.contactPhone})· ${order.deliveryAddress}`
                          : '未填写收货信息(线下约定收货)'}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <PackageCheck size={13} className="text-emerald-600" />
                        付款条件:{order.paymentTerms}
                      </p>
                    </div>
                    <OrderFulfillment key={order.id} order={order} canReadReceipts={can('buyer:receipt:read')} canReceive={can('buyer:receipt:manage')} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={mallOrders.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
