import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import {
  useSupplierDeliveryCreate,
  useSupplierOrderConfirm,
  useSupplierOrderList,
} from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 销售订单:供应商确认订单(待确认→待发货),并登记发货(承运商/运单/数量)。
export function OrdersPage() {
  const queryClient = useQueryClient();
  const orders = useSupplierOrderList();
  const confirm = useSupplierOrderConfirm();
  const ship = useSupplierDeliveryCreate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState<{ orderId: string; carrier: string; trackingNo: string; qty: string } | null>(null);

  const list = orders.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/supplier\/(orders|deliveries)/.test(q.queryKey[0] as string),
    });

  const onConfirm = (orderId: string) =>
    confirm.mutate({ orderId }, { onSuccess: () => { setFeedback(`订单 ${orderId} 已确认`); refresh(); } });

  const onShip = (orderId: string) => {
    const f = shipForm?.orderId === orderId ? shipForm : null;
    ship.mutate(
      {
        orderId,
        data: {
          carrier: f?.carrier || '顺丰速运',
          trackingNo: f?.trackingNo || `SF${Date.now().toString().slice(-9)}`,
          shippedQuantity: Number(f?.qty) || undefined,
        },
      },
      { onSuccess: () => { setFeedback(`订单 ${orderId} 已登记发货`); setShipForm(null); refresh(); } },
    );
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

  return (
    <Panel title="销售订单" icon={ShoppingCart} subtitle="订单确认 · 发货登记">
      <ListToolbar title="销售订单" recordCount={list.length} filterLabel="全部" actionLabel="采购方下达" />
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {orders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载销售订单…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无销售订单。采购方定标生成订单后出现在此。" />
      ) : (
        <div className="space-y-3">
          {list.map((o) => {
            const busyC = confirm.isPending && confirm.variables?.orderId === o.id;
            const busyS = ship.isPending && ship.variables?.orderId === o.id;
            const editing = shipForm?.orderId === o.id;
            return (
              <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">{o.id}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">询价 {o.rfqId ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {o.status && <StatusPill label={o.status} />}
                    <span className="font-mono text-sm font-black text-slate-900">{currency(o.amount)}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="预计到货" value={o.expectedReceiptDate ?? '—'} />
                  <MiniFact label="收货地址" value={o.deliveryAddress || '—'} />
                  <MiniFact label="付款方式" value={o.paymentTerms ?? '—'} />
                </div>

                {o.status === '待确认' && o.id && (
                  <PrimaryActionButton onClick={() => onConfirm(o.id!)} busy={busyC} pendingLabel="确认中">
                    确认订单
                  </PrimaryActionButton>
                )}

                {o.status === '待发货' && o.id && (
                  editing ? (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                      <p className="text-xs font-black text-emerald-800">发货登记</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <input className={inputCls} placeholder="承运商" value={shipForm!.carrier}
                          onChange={(e) => setShipForm({ ...shipForm!, carrier: e.target.value })} />
                        <input className={inputCls} placeholder="运单号" value={shipForm!.trackingNo}
                          onChange={(e) => setShipForm({ ...shipForm!, trackingNo: e.target.value })} />
                        <input className={inputCls} type="number" placeholder="发货数量" value={shipForm!.qty}
                          onChange={(e) => setShipForm({ ...shipForm!, qty: e.target.value })} />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <PrimaryActionButton onClick={() => onShip(o.id!)} busy={busyS} pendingLabel="提交中">
                          提交发货
                        </PrimaryActionButton>
                        <button type="button" onClick={() => setShipForm(null)}
                          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button"
                      onClick={() => setShipForm({ orderId: o.id!, carrier: '顺丰速运', trackingNo: '', qty: '' })}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700">
                      登记发货
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
