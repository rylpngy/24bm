import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Info, Truck } from 'lucide-react';
import {
  useBuyerDeliveryList,
  useBuyerReceiptCreate,
  useBuyerReceiptList,
  useBuyerSupplierList,
  usePurchaseOrderList,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
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

// 验收表单是否存在不合格(行项任一合格<收货,或抬头合格<收货)。
type ReceiveFormState = {
  received: string;
  qualified: string;
  lines: { received: string; qualified: string }[];
};
const receiveHasUnqualified = (f: ReceiveFormState): boolean => {
  if ((f.lines ?? []).length > 0) {
    return f.lines.some((l) => (Number(l.qualified) || 0) < (Number(l.received) || 0));
  }
  return (Number(f.qualified) || 0) < (Number(f.received) || 0);
};

// 验收结论配色。
const conclusionCls = (c?: string | null) => {
  if (c === '全部合格') return 'bg-emerald-100 text-emerald-700';
  if (c === '部分合格') return 'bg-amber-100 text-amber-700';
  if (c === '全部不合格') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-500';
};

// S5b:采购订单履约。表格列表 → 详情页(抬头/行项/物流/收货验收),对齐采购需求页面规范。
export function OrdersPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = usePurchaseOrderList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const receiptsQuery = useBuyerReceiptList();
  const deliveriesQuery = useBuyerDeliveryList();
  const receipt = useBuyerReceiptCreate();
  const allOrders = query.data?.data ?? [];

  // 收货验收的录入表单(仅详情页展开)。lines 非空时按行验收,否则退化为抬头数量。
  const [receiveForm, setReceiveForm] = useState<{
    orderId: string;
    received: string;
    qualified: string;
    note: string;
    disposition: string;
    lines: {
      orderLineId: string;
      description: string;
      unit?: string;
      ordered?: number;
      received: string;
      qualified: string;
    }[];
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

  const statuses = ['全部', ...Array.from(new Set(allOrders.map((o) => o.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const orders = allOrders.filter((o) => {
    if (statusFilter !== '全部' && o.status !== statusFilter) return false;
    if (!kw) return true;
    const supplierName = o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '';
    return [o.id, o.rfqId, supplierName].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) =>
    s === '全部' ? allOrders.length : allOrders.filter((o) => o.status === s).length;
  const totalAmount = allOrders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = orders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(orders|receipts)/.test(q.queryKey[0] as string),
    });

  const handleReceive = (orderId: string) => {
    const form = receiveForm?.orderId === orderId ? receiveForm : null;
    const hasLines = (form?.lines ?? []).length > 0;
    let data;
    let unqualified = false;
    if (hasLines && form) {
      const lineItems = form.lines.map((r) => ({
        orderLineId: r.orderLineId,
        receivedQuantity: Number(r.received) || 0,
        qualifiedQuantity: Number(r.qualified) || 0,
      }));
      unqualified = lineItems.some((li) => li.qualifiedQuantity < li.receivedQuantity);
      // 抬头数量取行项汇总,供后端判定结论与处置门槛。
      const totalReceived = lineItems.reduce((s, li) => s + li.receivedQuantity, 0);
      const totalQualified = lineItems.reduce((s, li) => s + li.qualifiedQuantity, 0);
      data = {
        result: unqualified ? '部分合格' : '验收合格',
        receivedQuantity: totalReceived,
        qualifiedQuantity: totalQualified,
        qualityNote: form.note || '',
        lineItems,
      };
    } else {
      const received = form ? Number(form.received) || 0 : 0;
      const qualified = form ? Number(form.qualified) || 0 : 0;
      unqualified = qualified < received;
      data = {
        result: unqualified ? '部分合格' : '验收合格',
        receivedQuantity: received,
        qualifiedQuantity: qualified,
        qualityNote: form?.note || '',
      };
    }
    if (unqualified) {
      (data as Record<string, unknown>).disposition = form?.disposition ?? '退货换货';
      (data as Record<string, unknown>).dispositionNote = form?.note ?? '';
    }
    receipt.mutate(
      { orderId, data },
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

  const selected = selectedId ? allOrders.find((o) => o.id === selectedId) : undefined;

  // ── 详情页 ────────────────────────────────────────────────
  if (selected) {
    const o = selected;
    const delivery = o.id ? deliveryByOrder[o.id] : undefined;
    const rec = o.id ? receiptByOrder[o.id] : undefined;
    const supplierName = o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '—';
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setReceiveForm(null);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回订单列表"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-mono text-lg font-black text-slate-950">{o.id}</h1>
                {o.status && <StatusPill label={o.status} />}
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">
                供应商 {supplierName} · 关联询比 {o.rfqId ?? '—'}
              </p>
            </div>
            <p className="shrink-0 font-mono text-xl font-black text-slate-950">{currency(o.amount)}</p>
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}

        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            {/* 抬头信息 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">订单信息</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="关联询比" value={o.rfqId ?? '—'} />
                <MiniFact label="预计到货" value={o.expectedReceiptDate ?? '—'} />
                <MiniFact label="付款方式" value={o.paymentTerms ?? '—'} />
                <MiniFact label="收货联系人" value={o.contactName ? `${o.contactName}` : '—'} />
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
            </section>

            {/* 行项明细 */}
            {(o.lineItems ?? []).length > 0 && (
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
                <p className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-500">
                  订单行项明细({(o.lineItems ?? []).length} 项 · 源自中标报价)
                </p>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                    <tr>
                      <th className="px-4 py-2">品名/规格</th>
                      <th className="px-4 py-2 text-right">数量</th>
                      <th className="px-4 py-2 text-right">单价</th>
                      <th className="px-4 py-2 text-right">行金额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(o.lineItems ?? []).map((l) => (
                      <tr key={l.id} className="font-bold text-slate-700">
                        <td className="px-4 py-2">{l.description}</td>
                        <td className="px-4 py-2 text-right">
                          {l.quantity}
                          {l.unit ? ` ${l.unit}` : ''}
                        </td>
                        <td className="px-4 py-2 text-right">{currency(l.unitPrice)}</td>
                        <td className="px-4 py-2 text-right font-black text-slate-900">{currency(l.lineAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* 物流信息 */}
            {delivery && (
              <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-xs font-black text-indigo-700">物流信息</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <MiniFact label="承运商" value={delivery.carrier ?? '—'} />
                  <MiniFact label="运单号" value={delivery.trackingNo ?? '—'} />
                  <MiniFact label="发货数量" value={String(delivery.shippedQuantity ?? '—')} />
                  <MiniFact label="发货日期" value={delivery.shippedDate ?? '—'} />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <MiniFact label="预计到货" value={delivery.estimatedArrival ?? '—'} />
                  <MiniFact label="物流状态" value={delivery.status ?? '—'} />
                </div>
                {delivery.logisticsNote && (
                  <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-700">{delivery.logisticsNote}</p>
                )}
              </section>
            )}

            {/* 收货验收明细(已收货) */}
            {o.status === '已收货' && rec && (
              <section className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="flex flex-wrap items-center gap-2 text-xs font-black text-emerald-700">
                  收货验收明细
                  {rec.inspectionConclusion && (
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-black', conclusionCls(rec.inspectionConclusion))}>
                      {rec.inspectionConclusion}
                    </span>
                  )}
                  {rec.disposition && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                      处置:{rec.disposition}
                    </span>
                  )}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <MiniFact label="验收结论" value={rec.result ?? '—'} />
                  <MiniFact label="收货数量" value={String(rec.receivedQuantity ?? '—')} />
                  <MiniFact label="合格数量" value={String(rec.qualifiedQuantity ?? '—')} />
                  <MiniFact label="合格率" value={ratePct(rec.qualifiedQuantity, rec.receivedQuantity)} />
                </div>
                {(rec.lineItems ?? []).length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-emerald-100 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-emerald-50 text-[11px] font-black text-emerald-700">
                        <tr>
                          <th className="px-3 py-1.5">品名/规格</th>
                          <th className="px-3 py-1.5 text-right">订购</th>
                          <th className="px-3 py-1.5 text-right">收货</th>
                          <th className="px-3 py-1.5 text-right">合格</th>
                          <th className="px-3 py-1.5 text-right">合格率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50">
                        {(rec.lineItems ?? []).map((l) => (
                          <tr key={l.id} className="font-bold text-slate-700">
                            <td className="px-3 py-1.5">{l.description}</td>
                            <td className="px-3 py-1.5 text-right">
                              {l.orderedQuantity}
                              {l.unit ? ` ${l.unit}` : ''}
                            </td>
                            <td className="px-3 py-1.5 text-right">{l.receivedQuantity}</td>
                            <td className="px-3 py-1.5 text-right font-black text-slate-900">{l.qualifiedQuantity}</td>
                            <td className="px-3 py-1.5 text-right">{ratePct(Number(l.qualifiedQuantity), Number(l.receivedQuantity))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {rec.qualityNote && (
                  <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-700">{rec.qualityNote}</p>
                )}
              </section>
            )}

            {/* 收货验收登记(已发货) */}
            {o.status === '已发货' && o.id && (
              <section>
                {receiveForm?.orderId === o.id ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                    <p className="text-xs font-black text-blue-800">收货验收登记</p>
                    {receiveForm.lines.length > 0 ? (
                      <div className="mt-2 overflow-hidden rounded-lg border border-blue-100 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-blue-50 text-[11px] font-black text-blue-700">
                            <tr>
                              <th className="px-3 py-1.5">品名/规格</th>
                              <th className="px-3 py-1.5 text-right">订购</th>
                              <th className="w-20 px-2 py-1.5">收货</th>
                              <th className="w-20 px-2 py-1.5">合格</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {receiveForm.lines.map((r, idx) => (
                              <tr key={r.orderLineId} className="font-bold text-slate-700">
                                <td className="px-3 py-1.5">{r.description}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {r.ordered}
                                  {r.unit ? ` ${r.unit}` : ''}
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" min={0}
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold outline-none focus:border-blue-300"
                                    value={r.received}
                                    onChange={(e) =>
                                      setReceiveForm((f) => {
                                        if (!f) return f;
                                        const lines = f.lines.map((x, i) => (i === idx ? { ...x, received: e.target.value } : x));
                                        return { ...f, lines };
                                      })
                                    } />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" min={0}
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold outline-none focus:border-blue-300"
                                    value={r.qualified}
                                    onChange={(e) =>
                                      setReceiveForm((f) => {
                                        if (!f) return f;
                                        const lines = f.lines.map((x, i) => (i === idx ? { ...x, qualified: e.target.value } : x));
                                        return { ...f, lines };
                                      })
                                    } />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-black text-slate-500">收货数量</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            value={receiveForm.received}
                            onChange={(e) => setReceiveForm((f) => f && { ...f, received: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-black text-slate-500">合格数量</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            value={receiveForm.qualified}
                            onChange={(e) => setReceiveForm((f) => f && { ...f, qualified: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <label className="text-[11px] font-black text-slate-500">验收说明</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        placeholder="如:抽检结果、外观与数量核对情况"
                        value={receiveForm.note}
                        onChange={(e) => setReceiveForm((f) => f && { ...f, note: e.target.value })}
                      />
                    </div>
                    {receiveHasUnqualified(receiveForm) && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                        <label className="text-[11px] font-black text-amber-700">存在不合格,须选择处置方式</label>
                        <div className="mt-1.5 flex gap-2">
                          {['退货换货', '让步接收'].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setReceiveForm((f) => f && { ...f, disposition: d })}
                              className={
                                receiveForm.disposition === d
                                  ? 'h-8 rounded-md border border-amber-400 bg-amber-100 px-3 text-xs font-black text-amber-800'
                                  : 'h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50'
                              }
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                      setReceiveForm({
                        orderId: o.id!,
                        received: '',
                        qualified: '',
                        note: '',
                        disposition: '退货换货',
                        lines: (o.lineItems ?? []).map((l) => ({
                          orderLineId: l.id!,
                          description: l.description ?? '',
                          unit: l.unit,
                          ordered: l.quantity,
                          received: String(l.quantity ?? ''),
                          qualified: String(l.quantity ?? ''),
                        })),
                      })
                    }
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
                  >
                    确认收货
                  </button>
                )}
              </section>
            )}
          </div>

          {/* 右栏:关键信息 + 履约进度 */}
          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black">
                <Info size={15} className="text-blue-400" /> 关键信息
              </p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['供应商', supplierName],
                  ['订单金额', currency(o.amount)],
                  ['订单状态', o.status ?? '—'],
                  ['预计到货', o.expectedReceiptDate ?? '—'],
                  ['付款方式', o.paymentTerms ?? '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <p className="text-sm font-black text-slate-950">履约进度</p>
              <div className="mt-4 space-y-0">
                {[
                  { label: '订单创建', time: o.createdAt?.slice(0, 10) ?? null, done: true },
                  { label: '供应商发货', time: delivery?.shippedDate ?? null, done: !!delivery },
                  { label: '收货验收', time: rec ? (rec.result ?? '已验收') : null, done: !!rec },
                ].map((step, idx, arr) => (
                  <div key={step.label} className="relative pl-5">
                    {idx < arr.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
                    <span
                      className={cn(
                        'absolute left-0 top-1 h-2.5 w-2.5 rounded-full border-2',
                        step.done ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white',
                      )}
                    />
                    <p className={cn('text-xs font-black', step.done ? 'text-slate-900' : 'text-slate-400')}>{step.label}</p>
                    <p className="mt-0.5 pb-3 font-mono text-[11px] font-bold text-slate-400">{step.time ?? '待进行'}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ── 列表页 ────────────────────────────────────────────────
  return (
    <Panel title="采购订单" icon={Truck} subtitle="订单履约 · 抬头信息 · 收货验收">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="订单总数" value={String(allOrders.length)} />
        <MiniFact label="已发货待收" value={String(statusCount('已发货'))} />
        <MiniFact label="已收货" value={String(statusCount('已收货'))} />
        <MiniFact label="订单总金额" value={currency(totalAmount)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : statusCount(s) }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按订单号 / 询比号 / 供应商搜索"
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

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载采购订单…" />
      ) : orders.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的订单。'
              : '暂无采购订单。定标审批通过后由系统生成。'
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
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {o.status && <StatusPill label={o.status} />}
                    <span className="font-mono text-sm font-black text-slate-900">{currency(o.amount)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => o.id && setSelectedId(o.id)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  {o.status === '已发货' ? '收货验收' : '查看详情'}
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">订单编号</th>
                  <th className="px-5 py-4">供应商</th>
                  <th className="px-5 py-4">预计到货</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">订单金额</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((o, i) => (
                  <tr key={o.id} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-5">
                      <p className="w-44 truncate font-mono text-xs font-black text-slate-900" title={o.id}>
                        {o.id}
                      </p>
                      <p className="mt-1 w-44 truncate font-mono text-[11px] font-bold text-slate-400" title={o.rfqId ?? undefined}>
                        询比 {o.rfqId ?? '—'}
                      </p>
                    </td>
                    <td className="px-5 py-5 text-sm font-bold text-slate-600">
                      {o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '—'}
                    </td>
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{o.expectedReceiptDate ?? '—'}</td>
                    <td className="px-5 py-5">{o.status && <StatusPill label={o.status} />}</td>
                    <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(o.amount)}</td>
                    <td className="px-5 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {o.status === '已发货' && (
                          <button
                            type="button"
                            onClick={() => o.id && setSelectedId(o.id)}
                            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                          >
                            收货验收
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => o.id && setSelectedId(o.id)}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          详情
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={orders.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
