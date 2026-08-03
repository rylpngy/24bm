import { useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import { usePurchaseOrderList } from '@24bid/api-client';
import { FeedbackNotice, Pagination, StatusPill, cn } from '@24bid/ui';
import { currency } from '../catalog/product-card';

const PAGE_SIZE = 8;

/**
 * 我的订单:只列商城渠道的订单(sourceMethod=商城)。
 *
 * <p>订单详情与收货确认仍在采购工作台完成——商城门户不重复实现履约操作,
 * 避免同一动作两处实现导致状态口径分叉。
 */
export function MallOrdersPage() {
  const orders = usePurchaseOrderList();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

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
                    <ul className="space-y-1">
                      {(order.lineItems ?? []).map((line, index) => (
                        <li
                          key={`${order.id}-${index}`}
                          className="flex justify-between text-xs font-bold text-slate-600"
                        >
                          <span className="truncate">
                            {line.description} × {line.quantity}{line.unit}
                          </span>
                          <span className="font-mono">{currency(line.lineAmount)}</span>
                        </li>
                      ))}
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
