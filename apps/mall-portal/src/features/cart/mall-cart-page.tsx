import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShoppingCart, Trash2 } from 'lucide-react';
import {
  useBuyerMallCart,
  useBuyerMallRemoveCartItem,
  useBuyerMallUpdateCartItem,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton, cn } from '@24bid/ui';
import type { MallRoute } from '../../App';
import { currency } from '../catalog/product-card';
import { useMallPermissions } from '../../lib/use-mall-permissions';

/**
 * 购物车页:按供应商分组(与结算拆单同口径),行内步进改量,失效行给出原因。
 *
 * <p>单价与小计来自服务端实时计算,前端不自己算价——避免与成交价对不上。
 */
export function MallCartPage({ onNavigate }: { onNavigate: (route: MallRoute) => void }) {
  const queryClient = useQueryClient();
  const { can } = useMallPermissions();
  const canPurchase = can('buyer:mall:purchase');
  const cart = useBuyerMallCart();
  const updateItem = useBuyerMallUpdateCartItem();
  const removeItem = useBuyerMallRemoveCartItem();

  const view = cart.data?.data;
  const groups = view?.groups ?? [];
  const busy = updateItem.isPending || removeItem.isPending;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string'
        && (q.queryKey[0] as string).includes('/buyer/mall'),
    });

  if (cart.isLoading) {
    return <FeedbackNotice tone="info" message="正在加载购物车…" />;
  }
  if (cart.isError) return <FeedbackNotice tone="error" message="购物车加载失败，请刷新重试。" />;

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <ShoppingCart size={32} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-black text-slate-700">购物车是空的</p>
        <p className="mt-1 text-xs font-bold text-slate-400">去商品列表挑选协议价商品吧。</p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'category' })}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700"
        >
          去逛商城
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <section className="min-w-0 space-y-4">
        <h1 className="text-xl font-black text-slate-950">购物车</h1>
        {(updateItem.isError || removeItem.isError) && <FeedbackNotice tone="error" message="购物车更新失败，请刷新后重试。" />}
        {view?.hasBlockedItems && (
          <FeedbackNotice
            tone="error"
            message="存在不可结算的商品(下架、低于起订量或超库存),处理后才能提交订单。"
          />
        )}
        {groups.map((group) => (
          <div
            key={group.supplierId}
            className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-black text-slate-900">{group.supplierName}</p>
              <p className="text-xs font-bold text-slate-500">
                小计 <b className="font-mono text-slate-900">{currency(group.subtotal)}</b>
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {(group.lines ?? []).map((line) => (
                <div key={line.skuId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        line.productId && onNavigate({ name: 'product', productId: line.productId })
                      }
                      className="truncate text-sm font-black text-slate-900 hover:text-blue-700"
                    >
                      {line.productName}
                    </button>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                      {currency(line.unitPrice)} / {line.unit}
                      {line.minOrderQty != null && ` · 起订 ${line.minOrderQty}${line.unit}`}
                      {line.stockQty != null && ` · 库存 ${line.stockQty}${line.unit}`}
                    </p>
                    {line.blockedReason && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-black text-red-600">
                        <AlertTriangle size={11} /> {line.blockedReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {canPurchase && [-1, 1].map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          line.skuId && updateItem.mutate(
                            {
                              data: {
                                skuId: line.skuId,
                                quantity: (line.quantity ?? 0) + direction * (line.stepQty ?? 1),
                              },
                            },
                            { onSuccess: refresh },
                          )
                        }
                        aria-label={`${direction > 0 ? '增加' : '减少'} ${line.productName} 数量`}
                        className="h-7 w-7 rounded border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        {direction > 0 ? '+' : '−'}
                      </button>
                    ))}
                    <span className="min-w-14 text-center text-xs font-black text-slate-900">
                      {line.quantity} {line.unit}
                    </span>
                  </div>

                  <span className={cn(
                    'w-24 text-right font-mono text-sm font-black',
                    line.blockedReason ? 'text-slate-300 line-through' : 'text-slate-900',
                  )}>
                    {currency(line.lineTotal)}
                  </span>

                  {canPurchase && <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      line.skuId && removeItem.mutate({ skuId: line.skuId }, { onSuccess: refresh })
                    }
                    aria-label={`移除 ${line.productName}`}
                    className="text-slate-400 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <h2 className="text-base font-black text-slate-950">结算</h2>
          <dl className="mt-3 space-y-2 text-xs font-bold text-slate-600">
            <div className="flex justify-between">
              <dt>商品件数</dt>
              <dd className="font-black text-slate-900">{view?.itemCount ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt>供应商</dt>
              <dd className="font-black text-slate-900">{groups.length} 家(自动拆单)</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <dt>可结算合计</dt>
              <dd className="font-mono text-lg font-black text-blue-700">{currency(view?.total)}</dd>
            </div>
          </dl>
          {canPurchase && <div className="mt-4">
            <PrimaryActionButton
              fullWidth
              disabled={view?.hasBlockedItems || (view?.itemCount ?? 0) === 0}
              onClick={() => onNavigate({ name: 'checkout' })}
            >
              去结算
            </PrimaryActionButton>
          </div>}
          <p className="mt-2 text-[11px] font-bold text-slate-400">
            跨供应商将按供应商拆成多张采购订单,分别履约与对账。
          </p>
        </div>
      </aside>
    </div>
  );
}
