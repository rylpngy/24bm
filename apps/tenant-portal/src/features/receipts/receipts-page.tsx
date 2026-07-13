import { Fragment, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, Info, PackageCheck } from 'lucide-react';
import {
  type PurchaseOrderResponse,
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
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  cn,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

const conclusionCls = (c?: string | null) => {
  if (c === '全部合格') return 'bg-emerald-100 text-emerald-700';
  if (c === '部分合格') return 'bg-amber-100 text-amber-700';
  if (c === '全部不合格') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-500';
};

const ratePct = (q?: number, r?: number) =>
  r && r > 0 && q != null ? `${Math.round((q / r) * 100)}%` : '—';

interface ReceiveLine {
  orderLineId: string;
  description: string;
  unit?: string;
  ordered?: number;
  received: string;
  qualified: string;
}

// 收货验收工作台:待验收队列 → 验收登记独立页 → 验收记录台账;订单页仅保留只读结果。
export function ReceiptsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  const ordersQuery = usePurchaseOrderList();
  const receiptsQuery = useBuyerReceiptList();
  const deliveriesQuery = useBuyerDeliveryList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const receipt = useBuyerReceiptCreate();

  const orders = ordersQuery.data?.data ?? [];
  const receipts = receiptsQuery.data?.data ?? [];

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    (suppliersQuery.data?.data ?? []).forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliersQuery.data]);

  const deliveryByOrder = useMemo(() => {
    const list = deliveriesQuery.data?.data ?? [];
    const map: Record<string, (typeof list)[number]> = {};
    list.forEach((d) => {
      if (d.orderId) map[d.orderId] = d;
    });
    return map;
  }, [deliveriesQuery.data]);

  const supplierOf = (o: PurchaseOrderResponse) =>
    o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '—';

  const kw = keyword.toLowerCase();
  const pendingAll = orders.filter((o) => o.status === '已发货');
  const pending = pendingAll.filter((o) =>
    !kw || [o.id, o.rfqId, supplierOf(o), deliveryByOrder[o.id ?? '']?.trackingNo]
      .filter(Boolean).join(' ').toLowerCase().includes(kw),
  );
  const done = receipts.filter((r) =>
    !kw || [r.orderId, r.result, r.inspectionConclusion].filter(Boolean).join(' ').toLowerCase().includes(kw),
  );

  // 真实汇总:平均合格率 = Σ合格/Σ收货;不合格 = 合格<收货 的验收单。
  const totalReceived = receipts.reduce((s, r) => s + (r.receivedQuantity ?? 0), 0);
  const totalQualified = receipts.reduce((s, r) => s + (r.qualifiedQuantity ?? 0), 0);
  const unqualifiedCount = receipts.filter(
    (r) => (r.qualifiedQuantity ?? 0) < (r.receivedQuantity ?? 0),
  ).length;

  const list = tab === 'pending' ? pending : done;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(orders|receipts)/.test(q.queryKey[0] as string),
    });
  };

  // ── 验收登记独立页 ─────────────────────────────────────────
  const receivingOrder = receivingId ? orders.find((o) => o.id === receivingId) : undefined;
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [headReceived, setHeadReceived] = useState('');
  const [headQualified, setHeadQualified] = useState('');
  const [note, setNote] = useState('');
  const [disposition, setDisposition] = useState('退货换货');

  const startReceiving = (o: PurchaseOrderResponse) => {
    setReceivingId(o.id ?? null);
    setLines(
      (o.lineItems ?? []).map((l) => ({
        orderLineId: l.id!,
        description: l.description ?? '',
        unit: l.unit,
        ordered: l.quantity,
        received: String(l.quantity ?? ''),
        qualified: String(l.quantity ?? ''),
      })),
    );
    setHeadReceived('');
    setHeadQualified('');
    setNote('');
    setDisposition('退货换货');
    setError(null);
  };

  const hasUnqualified = lines.length > 0
    ? lines.some((l) => (Number(l.qualified) || 0) < (Number(l.received) || 0))
    : (Number(headQualified) || 0) < (Number(headReceived) || 0);

  const submitReceipt = () => {
    if (!receivingOrder?.id) return;
    let data: Record<string, unknown>;
    if (lines.length > 0) {
      const lineItems = lines.map((r) => ({
        orderLineId: r.orderLineId,
        receivedQuantity: Number(r.received) || 0,
        qualifiedQuantity: Number(r.qualified) || 0,
      }));
      const totalR = lineItems.reduce((s, li) => s + li.receivedQuantity, 0);
      const totalQ = lineItems.reduce((s, li) => s + li.qualifiedQuantity, 0);
      data = {
        result: hasUnqualified ? '部分合格' : '验收合格',
        receivedQuantity: totalR,
        qualifiedQuantity: totalQ,
        qualityNote: note || '',
        lineItems,
      };
    } else {
      data = {
        result: hasUnqualified ? '部分合格' : '验收合格',
        receivedQuantity: Number(headReceived) || 0,
        qualifiedQuantity: Number(headQualified) || 0,
        qualityNote: note || '',
      };
    }
    if (hasUnqualified) {
      data.disposition = disposition;
      data.dispositionNote = note;
    }
    receipt.mutate(
      { orderId: receivingOrder.id, data: data as never },
      {
        onSuccess: () => {
          setFeedback(`订单 ${receivingOrder.id} 收货验收完成`);
          setReceivingId(null);
          setTab('done');
          refresh();
        },
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              '验收提交失败,请稍后重试。',
          ),
      },
    );
  };

  if (receivingOrder) {
    const o = receivingOrder;
    const delivery = o.id ? deliveryByOrder[o.id] : undefined;
    const inputCls =
      'w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold outline-none focus:border-blue-300';
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReceivingId(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回待验收列表"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-mono text-lg font-black text-slate-950">{o.id}</h1>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">验收登记</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">
                供应商 {supplierOf(o)} · 订单金额 {currency(o.amount)}
              </p>
            </div>
          </div>
        </div>

        {error && <FeedbackNotice tone="error" message={error} />}

        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            {/* 行项验收 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">1</span>
                数量核对
              </h3>
              {lines.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="px-3 py-2">品名/规格</th>
                        <th className="px-3 py-2 text-right">订购</th>
                        <th className="w-24 px-2 py-2">实收数量</th>
                        <th className="w-24 px-2 py-2">合格数量</th>
                        <th className="px-3 py-2 text-right">合格率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((r, idx) => (
                        <tr key={r.orderLineId} className="font-bold text-slate-700">
                          <td className="px-3 py-2">{r.description}</td>
                          <td className="px-3 py-2 text-right">
                            {r.ordered}
                            {r.unit ? ` ${r.unit}` : ''}
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min={0} className={inputCls} value={r.received}
                              onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, received: e.target.value } : x)))} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min={0} className={inputCls} value={r.qualified}
                              onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, qualified: e.target.value } : x)))} />
                          </td>
                          <td className={cn('px-3 py-2 text-right font-black', (Number(r.qualified) || 0) < (Number(r.received) || 0) ? 'text-amber-700' : 'text-emerald-700')}>
                            {ratePct(Number(r.qualified) || 0, Number(r.received) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>收货数量</span>
                    <input type="number" min={0} className={cn(inputCls, 'mt-1 py-2')} value={headReceived} onChange={(e) => setHeadReceived(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>合格数量</span>
                    <input type="number" min={0} className={cn(inputCls, 'mt-1 py-2')} value={headQualified} onChange={(e) => setHeadQualified(e.target.value)} />
                  </label>
                </div>
              )}
            </section>

            {/* 质检说明 + 处置 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">2</span>
                质检结论
              </h3>
              <label className="mt-3 block">
                <span className="text-[11px] font-black text-slate-500">验收说明(选填)</span>
                <input
                  className={cn(inputCls, 'mt-1 py-2')}
                  placeholder="如:抽检结果、外观与数量核对情况"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className={cn('mt-3 rounded-lg border p-3', hasUnqualified ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-slate-50')}>
                {hasUnqualified ? (
                  <>
                    <p className="text-[11px] font-black text-amber-700">存在不合格,须选择处置方式</p>
                    <div className="mt-1.5 flex gap-2">
                      {['退货换货', '让步接收'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDisposition(d)}
                          className={
                            disposition === d
                              ? 'h-8 rounded-md border border-amber-400 bg-amber-100 px-3 text-xs font-black text-amber-800'
                              : 'h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50'
                          }
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] font-bold text-slate-500">当前数量核对无不合格,提交后结论为「验收合格」。</p>
                )}
              </div>
            </section>
          </div>

          {/* 右栏:物流 + 订单关键信息 */}
          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black">
                <Info size={15} className="text-blue-400" /> 订单关键信息
              </p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['供应商', supplierOf(o)],
                  ['订单金额', currency(o.amount)],
                  ['预计到货', o.expectedReceiptDate ?? '—'],
                  ['收货地址', o.deliveryAddress || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {delivery && (
              <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-xs font-black text-indigo-700">物流信息</p>
                <div className="mt-2 space-y-2">
                  <MiniFact label="承运商 / 运单号" value={`${delivery.carrier ?? '—'} · ${delivery.trackingNo ?? '—'}`} />
                  <MiniFact label="发货数量" value={String(delivery.shippedQuantity ?? '—')} />
                  <MiniFact label="发货日期" value={delivery.shippedDate ?? '—'} />
                  <MiniFact label="预计到达" value={delivery.estimatedArrival ?? '—'} />
                </div>
                {delivery.logisticsNote && (
                  <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-700">{delivery.logisticsNote}</p>
                )}
              </section>
            )}
          </div>
        </div>

        {/* 底部悬浮提交条 */}
        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <ClipboardCheck size={14} className="shrink-0 text-blue-600" />
              {hasUnqualified
                ? `存在不合格数量,结论将记为「部分合格」,处置方式:${disposition}。`
                : '数量核对无差异,提交后订单转为「已收货」。'}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setReceivingId(null)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                取消
              </button>
              <PrimaryActionButton onClick={submitReceipt} busy={receipt.isPending} pendingLabel="提交中" size="md" flushTop>
                提交验收
              </PrimaryActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 工作台列表 ─────────────────────────────────────────────
  return (
    <Panel title="收货验收" icon={PackageCheck} subtitle="待验收队列 · 验收登记 · 质检记录">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="待验收订单" value={`${pendingAll.length} 单`} />
        <MiniFact label="已完成验收" value={`${receipts.length} 单`} />
        <MiniFact label="累计合格率" value={ratePct(totalQualified, totalReceived)} />
        <MiniFact label="含不合格验收" value={`${unqualifiedCount} 单`} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={[
            { id: 'pending', label: '待验收', count: pendingAll.length },
            { id: 'done', label: '验收记录', count: receipts.length },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id as 'pending' | 'done');
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按订单号 / 供应商 / 运单号搜索"
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
      {error && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {ordersQuery.isLoading || receiptsQuery.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载验收数据…" />
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <FeedbackNotice
            tone="info"
            message={keyword ? '没有符合条件的待验收订单。' : '暂无待验收订单。供应商发货后订单进入待验收队列。'}
          />
        ) : (
          <>
            <ResponsiveTableFrame
              mobileCards={pending.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map((o, i) => (
                <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-mono font-black text-slate-950">
                        <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                        {o.id}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{supplierOf(o)}</p>
                    </div>
                    <span className="font-mono text-sm font-black text-slate-900">{currency(o.amount)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => startReceiving(o)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-blue-600 text-xs font-black text-white hover:bg-blue-700"
                  >
                    验收登记
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
                    <th className="px-5 py-4">物流(承运商 · 运单)</th>
                    <th className="px-5 py-4 text-right">发货数量</th>
                    <th className="px-5 py-4">预计到达</th>
                    <th className="px-5 py-4 text-right">订单金额</th>
                    <th className="px-5 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map((o, i) => {
                    const d = o.id ? deliveryByOrder[o.id] : undefined;
                    return (
                      <tr key={o.id} className="hover:bg-blue-50/30">
                        <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                          {(safePage - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-5 py-5">
                          <p className="w-44 truncate font-mono text-xs font-black text-slate-900" title={o.id}>{o.id}</p>
                          <p className="mt-1 w-44 truncate font-mono text-[11px] font-bold text-slate-400" title={o.rfqId ?? undefined}>
                            询比 {o.rfqId ?? '—'}
                          </p>
                        </td>
                        <td className="px-5 py-5 text-sm font-bold text-slate-600">{supplierOf(o)}</td>
                        <td className="px-5 py-5">
                          <p className="text-xs font-bold text-slate-600">{d?.carrier ?? '—'}</p>
                          <p className="mt-0.5 w-36 truncate font-mono text-[11px] font-bold text-slate-400" title={d?.trackingNo ?? undefined}>
                            {d?.trackingNo ?? '—'}
                          </p>
                        </td>
                        <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{d?.shippedQuantity ?? '—'}</td>
                        <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{d?.estimatedArrival ?? o.expectedReceiptDate ?? '—'}</td>
                        <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(o.amount)}</td>
                        <td className="px-5 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => startReceiving(o)}
                            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                          >
                            验收登记
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ResponsiveTableFrame>
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={pending.length} onPageChange={setPage} />
          </>
        )
      ) : done.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword ? '没有符合条件的验收记录。' : '暂无验收记录。'} />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={done.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map((r, i) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <p className="break-words font-mono font-black text-slate-950">
                    <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                    {r.orderId}
                  </p>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-black', conclusionCls(r.inspectionConclusion))}>
                    {r.inspectionConclusion ?? r.result ?? '—'}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  收货 {r.receivedQuantity ?? '—'} · 合格 {r.qualifiedQuantity ?? '—'} · 合格率{' '}
                  {ratePct(r.qualifiedQuantity, r.receivedQuantity)}
                </p>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">关联订单</th>
                  <th className="px-5 py-4">验收结论</th>
                  <th className="px-5 py-4 text-right">收货</th>
                  <th className="px-5 py-4 text-right">合格</th>
                  <th className="px-5 py-4 text-right">合格率</th>
                  <th className="px-5 py-4">处置</th>
                  <th className="px-5 py-4">验收时间</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {done.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map((r, i) => (
                  <Fragment key={r.id}>
                    <tr className={cn('hover:bg-blue-50/30', expandedReceiptId === r.id && 'bg-blue-50/30')}>
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-44 truncate font-mono text-xs font-black text-slate-900" title={r.orderId ?? undefined}>
                          {r.orderId}
                        </p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded px-2 py-0.5 text-[11px] font-black', conclusionCls(r.inspectionConclusion))}>
                          {r.inspectionConclusion ?? r.result ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-5 text-right font-mono font-bold text-slate-700">{r.receivedQuantity ?? '—'}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{r.qualifiedQuantity ?? '—'}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-emerald-700">
                        {ratePct(r.qualifiedQuantity, r.receivedQuantity)}
                      </td>
                      <td className="px-5 py-5 text-xs font-bold text-slate-600">{r.disposition ?? '—'}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-500">
                        {r.receivedAt?.slice(0, 16).replace('T', ' ') ?? '—'}
                      </td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedReceiptId(expandedReceiptId === r.id ? null : r.id ?? null)}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          {expandedReceiptId === r.id ? '收起' : '明细'}
                        </button>
                      </td>
                    </tr>
                    {expandedReceiptId === r.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={9} className="px-5 py-4">
                          {(r.lineItems ?? []).length > 0 && (
                            <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                                  <tr>
                                    <th className="px-3 py-1.5">品名/规格</th>
                                    <th className="px-3 py-1.5 text-right">订购</th>
                                    <th className="px-3 py-1.5 text-right">收货</th>
                                    <th className="px-3 py-1.5 text-right">合格</th>
                                    <th className="px-3 py-1.5 text-right">合格率</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(r.lineItems ?? []).map((l) => (
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
                          {r.qualityNote && (
                            <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-600">验收说明:{r.qualityNote}</p>
                          )}
                          {r.dispositionNote && r.dispositionNote !== r.qualityNote && (
                            <p className="mt-1 break-words text-xs font-bold leading-5 text-amber-700">处置说明:{r.dispositionNote}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={done.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
