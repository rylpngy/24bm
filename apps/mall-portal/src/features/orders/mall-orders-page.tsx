import { useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import {
  useBuyerMallAfterSales,
  useBuyerMallApplyAfterSales,
  useBuyerMallReviews,
  useBuyerMallSubmitReview,
  usePurchaseOrderList,
} from '@24bid/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useMallPermissions } from '../../lib/use-mall-permissions';
import { FeedbackNotice, Pagination, PrimaryActionButton, StatusPill, cn } from '@24bid/ui';
import { currency } from '../catalog/product-card';

const PAGE_SIZE = 8;

/**
 * 我的订单:只列商城渠道的订单(sourceMethod=商城)。
 *
 * <p>订单详情与收货确认仍在采购工作台完成——商城门户不重复实现履约操作,
 * 避免同一动作两处实现导致状态口径分叉。
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
  const [asDraft, setAsDraft] = useState<Record<string, { type: string; reason: string }>>({});
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
  const lineAfterSales = (lineId?: string) =>
    (afterSales.data?.data ?? []).filter((a) => a.orderLineId === lineId);
  const lineReview = (lineId?: string) =>
    (reviews.data?.data ?? []).find((r) => r.orderLineId === lineId);

  // 按下单时间倒序:刚下的单必须在第一页第一条,否则用户下完单看不到自己的订单。
  const mallOrders = (orders.data?.data ?? [])
    .filter((o) => o.sourceMethod === '商城')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const pageCount = Math.max(1, Math.ceil(mallOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = mallOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (orders.isLoading) {
    return <FeedbackNotice tone="info" message="正在加载订单…" />;
  }
  if (orders.isError || afterSales.isError || reviews.isError) {
    return <FeedbackNotice tone="error" message="订单或售后信息加载失败，请刷新重试。" />;
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
                    <ul className="space-y-2">
                      {(order.lineItems ?? []).map((line, index) => {
                        const canAfterSales = can('buyer:mall:purchase') && (order.status === '已发货' || order.status === '已收货');
                        const canReview = can('buyer:mall:purchase') && order.status === '已收货';
                        const existingReview = lineReview(line.id);
                        const draft = asDraft[line.id ?? ''] ?? { type: '退货', reason: '' };
                        const rd = reviewDraft[line.id ?? ''] ?? { rating: 5, content: '' };
                        return (
                          <li key={`${order.id}-${index}`} className="rounded-md bg-slate-50/60 px-2.5 py-2">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span className="truncate">
                                {line.description} × {line.quantity}{line.unit}
                              </span>
                              <span className="font-mono">{currency(line.lineAmount)}</span>
                            </div>

                            {lineAfterSales(line.id).map((row) => (
                              <p key={row.id} className="mt-1 text-[11px] font-bold text-amber-700">
                                售后·{row.type} {row.status}
                                {row.supplierReply ? `:${row.supplierReply}` : ''}
                              </p>
                            ))}
                            {existingReview && (
                              <p className="mt-1 text-[11px] font-bold text-emerald-700">
                                已评价 {'★'.repeat(existingReview.rating ?? 0)}
                                {existingReview.content ? ` · ${existingReview.content}` : ''}
                              </p>
                            )}

                            {canAfterSales && lineAfterSales(line.id).length === 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                                  disabled={!draft.reason.trim()}
                                  onClick={() => {
                                    setError(null);
                                    order.id && line.id && applyAfterSales.mutate(
                                      {
                                        data: {
                                          orderId: order.id,
                                          orderLineId: line.id,
                                          type: draft.type,
                                          quantity: line.quantity ?? 1,
                                          reason: draft.reason.trim(),
                                        },
                                      },
                                      { onSuccess: refresh, onError: reportError },
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
                    <p className="mt-2 text-[11px] font-bold text-slate-400">
                      发货、验收与对账在采购工作台的「收货验收」中处理。
                    </p>
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
