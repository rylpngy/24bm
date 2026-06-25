import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import {
  useBuyerDeliveryList,
  useBuyerReceiptCreate,
  useBuyerReceiptList,
  useBuyerSupplierList,
  usePurchaseOrderList,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  StatusPill,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// S5b：采购订单履约。订单列表 + 抬头信息(收货地址/联系人/付款方式) + 已发货收货验收。
export function OrdersPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = usePurchaseOrderList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const receiptsQuery = useBuyerReceiptList();
  const deliveriesQuery = useBuyerDeliveryList();
  const receipt = useBuyerReceiptCreate();
  const orders = query.data?.data ?? [];

  // 收货验收的录入表单（每次只展开一个订单）。
  const [receiveForm, setReceiveForm] = useState<{
    orderId: string;
    received: string;
    qualified: string;
    note: string;
  } | null>(null);

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    (suppliersQuery.data?.data ?? []).forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliersQuery.data]);

  const receiptByOrder = useMemo(() => {
    const list = receiptsQuery.data?.data ?? [];
    const map: Record<string, (typeof list)[number]> = {};
    list.forEach((r) => {
      if (r.orderId) map[r.orderId] = r;
    });
    return map;
  }, [receiptsQuery.data]);

  const deliveryByOrder = useMemo(() => {
    const list = deliveriesQuery.data?.data ?? [];
    const map: Record<string, (typeof list)[number]> = {};
    list.forEach((d) => {
      if (d.orderId) map[d.orderId] = d;
    });
    return map;
  }, [deliveriesQuery.data]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(orders|receipts)/.test(q.queryKey[0] as string),
    });

  const handleReceive = (orderId: string) => {
    const form = receiveForm?.orderId === orderId ? receiveForm : null;
    const received = form ? Number(form.received) || 0 : 0;
    const qualified = form ? Number(form.qualified) || 0 : 0;
    const result = qualified > 0 && qualified < received ? '部分合格' : '验收合格';
    receipt.mutate(
      {
        orderId,
        data: {
          result,
          receivedQuantity: received,
          qualifiedQuantity: qualified,
          qualityNote: form?.note || '',
        },
      },
      {
        onSuccess: () => {
          setFeedback(`订单 ${orderId} 收货验收完成`);
          setReceiveForm(null);
          refresh();
        },
      },
    );
  };

  const ratePct = (q?: number, r?: number) =>
    r && r > 0 && q != null ? `${Math.round((q / r) * 100)}%` : '—';

  return (
    <Panel title="采购订单" icon={Truck} subtitle="订单履约 · 抬头信息 · 收货验收">
      <ListToolbar
        title="采购订单"
        recordCount={orders.length}
        filterLabel="全部"
        actionLabel="由定标生成"
      />
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载采购订单…" />
      ) : orders.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无采购订单。定标审批通过后由系统生成。" />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-mono font-black text-slate-950">{o.id}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    供应商 {o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {o.status && <StatusPill label={o.status} />}
                  <span className="font-mono text-sm font-black text-slate-900">
                    {currency(o.amount)}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="关联询价" value={o.rfqId ?? '—'} />
                <MiniFact label="预计到货" value={o.expectedReceiptDate ?? '—'} />
                <MiniFact label="付款方式" value={o.paymentTerms ?? '—'} />
                <MiniFact
                  label="收货联系人"
                  value={o.contactName ? `${o.contactName}` : '—'}
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-black text-slate-400">收货地址</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                    {o.deliveryAddress || '未填写收货地址。'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-black text-slate-400">收货联系方式</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                    {o.contactName || o.contactPhone
                      ? `${o.contactName || '—'} · ${o.contactPhone || '—'}`
                      : '未填写联系方式。'}
                  </p>
                </div>
              </div>

              {(o.lineItems ?? []).length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    订单行项明细（{(o.lineItems ?? []).length} 项 · 源自中标报价）
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

              {o.id && deliveryByOrder[o.id] && (
                <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                  <p className="text-xs font-black text-indigo-700">物流信息</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <MiniFact label="承运商" value={deliveryByOrder[o.id]!.carrier ?? '—'} />
                    <MiniFact label="运单号" value={deliveryByOrder[o.id]!.trackingNo ?? '—'} />
                    <MiniFact
                      label="发货数量"
                      value={String(deliveryByOrder[o.id]!.shippedQuantity ?? '—')}
                    />
                    <MiniFact label="发货日期" value={deliveryByOrder[o.id]!.shippedDate ?? '—'} />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <MiniFact
                      label="预计到货"
                      value={deliveryByOrder[o.id]!.estimatedArrival ?? '—'}
                    />
                    <MiniFact label="物流状态" value={deliveryByOrder[o.id]!.status ?? '—'} />
                  </div>
                  {deliveryByOrder[o.id]!.logisticsNote && (
                    <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-700">
                      {deliveryByOrder[o.id]!.logisticsNote}
                    </p>
                  )}
                </div>
              )}

              {o.status === '已收货' && o.id && receiptByOrder[o.id] && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-xs font-black text-emerald-700">收货验收明细</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <MiniFact label="验收结论" value={receiptByOrder[o.id]!.result ?? '—'} />
                    <MiniFact
                      label="收货数量"
                      value={String(receiptByOrder[o.id]!.receivedQuantity ?? '—')}
                    />
                    <MiniFact
                      label="合格数量"
                      value={String(receiptByOrder[o.id]!.qualifiedQuantity ?? '—')}
                    />
                    <MiniFact
                      label="合格率"
                      value={ratePct(
                        receiptByOrder[o.id]!.qualifiedQuantity,
                        receiptByOrder[o.id]!.receivedQuantity,
                      )}
                    />
                  </div>
                  {receiptByOrder[o.id]!.qualityNote && (
                    <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-700">
                      {receiptByOrder[o.id]!.qualityNote}
                    </p>
                  )}
                </div>
              )}

              {o.status === '已发货' && o.id && (
                <div className="mt-3">
                  {receiveForm?.orderId === o.id ? (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                      <p className="text-xs font-black text-blue-800">收货验收登记</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-black text-slate-500">收货数量</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            value={receiveForm.received}
                            onChange={(e) =>
                              setReceiveForm((f) => f && { ...f, received: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-black text-slate-500">合格数量</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            value={receiveForm.qualified}
                            onChange={(e) =>
                              setReceiveForm((f) => f && { ...f, qualified: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-[11px] font-black text-slate-500">验收说明</label>
                        <input
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          placeholder="如：抽检结果、外观与数量核对情况"
                          value={receiveForm.note}
                          onChange={(e) =>
                            setReceiveForm((f) => f && { ...f, note: e.target.value })
                          }
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReceive(o.id!)}
                          disabled={receipt.isPending && receipt.variables?.orderId === o.id}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                        >
                          {receipt.isPending && receipt.variables?.orderId === o.id ? '提交中' : '提交验收'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceiveForm(null)}
                          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setReceiveForm({ orderId: o.id!, received: '', qualified: '', note: '' })
                      }
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700"
                    >
                      确认收货
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
