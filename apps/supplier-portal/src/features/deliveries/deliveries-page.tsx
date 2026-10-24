import { Fragment, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import {
  type DeliveryResponse,
  useSupplierDeliveryList,
  useSupplierDeliveryUpdate,
} from '@24bid/api-client';
import {
  FilterTabs,
  FeedbackNotice,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';

const PAGE_SIZE = 8;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

interface EditForm {
  deliveryId: string;
  carrier: string;
  trackingNo: string;
  qty: string;
  shippedDate: string;
  estimatedArrival: string;
  note: string;
}

// 发货管理:发货单列表 + 物流信息维护(承运商/运单/到达预估/备注)。
export function DeliveriesPage() {
  const queryClient = useQueryClient();
  const deliveries = useSupplierDeliveryList();
  const update = useSupplierDeliveryUpdate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = deliveries.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((d) => d.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((d) => {
    if (statusFilter !== '全部' && d.status !== statusFilter) return false;
    if (!kw) return true;
    return [d.trackingNo, d.orderId, d.carrier].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((d) => d.status === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/supplier\/(deliveries|orders)/.test(q.queryKey[0] as string),
    });
  };

  const openEdit = (d: DeliveryResponse) =>
    setForm({
      deliveryId: d.id ?? '',
      carrier: d.carrier ?? '',
      trackingNo: d.trackingNo ?? '',
      qty: d.shippedQuantity != null ? String(d.shippedQuantity) : '',
      shippedDate: d.shippedDate ?? '',
      estimatedArrival: d.estimatedArrival ?? '',
      note: d.logisticsNote ?? '',
    });

  const submitEdit = () => {
    if (!form) return;
    update.mutate(
      {
        deliveryId: form.deliveryId,
        data: {
          carrier: form.carrier.trim(),
          trackingNo: form.trackingNo.trim(),
          shippedDate: form.shippedDate || undefined,
          estimatedArrival: form.estimatedArrival || undefined,
          logisticsNote: form.note.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setFeedback('物流信息已更新。');
          setForm(null);
          refresh();
        },
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              '更新失败,请稍后重试。',
          ),
      },
    );
  };

  const editRow = (d: DeliveryResponse) => {
    if (!form || form.deliveryId !== d.id) return null;
    const f = form;
    return (
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
        <p className="text-xs font-black text-blue-800">更新物流信息</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>承运商</span>
            <input className={cn(inputCls, 'mt-1')} value={f.carrier} onChange={(e) => setForm({ ...f, carrier: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>运单号</span>
            <input className={cn(inputCls, 'mt-1')} value={f.trackingNo} onChange={(e) => setForm({ ...f, trackingNo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-black text-slate-500">本批发货数量</span>
            <input className={cn(inputCls, 'mt-1')} type="number" value={f.qty} readOnly />
          </label>
          <label className="block">
            <span className="text-[11px] font-black text-slate-500">发货日期(选填)</span>
            <input className={cn(inputCls, 'mt-1')} type="date" value={f.shippedDate} onChange={(e) => setForm({ ...f, shippedDate: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-black text-slate-500">预计到达(选填)</span>
            <input className={cn(inputCls, 'mt-1')} type="date" value={f.estimatedArrival} onChange={(e) => setForm({ ...f, estimatedArrival: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] font-black text-slate-500">物流备注(选填)</span>
            <input className={cn(inputCls, 'mt-1')} value={f.note} onChange={(e) => setForm({ ...f, note: e.target.value })} />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <PrimaryActionButton
            onClick={submitEdit}
            busy={update.isPending}
            pendingLabel="保存中"
            disabled={!f.carrier.trim() || !f.trackingNo.trim()}
          >
            保存物流信息
          </PrimaryActionButton>
          <button
            type="button"
            onClick={() => setForm(null)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
        </div>
      </div>
    );
  };

  return (
    <Panel title="发货管理" icon={Truck} subtitle="发货单 · 物流跟踪与维护">
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
          placeholder="按运单号 / 订单号 / 承运商搜索"
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

      {deliveries.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载发货单…" />
      ) : deliveries.isError ? (
        <FeedbackNotice tone="error" message="发货单加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的发货单。'
              : '暂无发货单。在「销售订单」对待发货订单登记发货后出现在此。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((d, i) => (
              <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {d.trackingNo ?? d.id}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{d.carrier ?? '—'} · 订单 {d.orderId}</p>
                  </div>
                  {d.status && <StatusPill label={d.status} />}
                </div>
                {editRow(d) || (
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    更新物流
                  </button>
                )}
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">运单号</th>
                  <th className="px-5 py-4">关联订单</th>
                  <th className="px-5 py-4 text-right">发货数量</th>
                  <th className="px-5 py-4">发货日期</th>
                  <th className="px-5 py-4">预计到达</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((d, i) => (
                  <Fragment key={d.id}>
                    <tr className={cn('hover:bg-blue-50/30', form?.deliveryId === d.id && 'bg-blue-50/30')}>
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-mono text-xs font-black text-slate-900">{d.trackingNo ?? '—'}</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          {d.carrier ?? '承运商未填'}
                          {d.logisticsNote ? ` · ${d.logisticsNote}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{d.orderId}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">
                        {d.shippedQuantity ?? '—'}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{d.shippedDate ?? '—'}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{d.estimatedArrival ?? '—'}</td>
                      <td className="px-5 py-5">{d.status && <StatusPill label={d.status} />}</td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => (form?.deliveryId === d.id ? setForm(null) : openEdit(d))}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          {form?.deliveryId === d.id ? '收起' : '更新物流'}
                        </button>
                      </td>
                    </tr>
                    {form?.deliveryId === d.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={8} className="px-5 py-4">
                          {editRow(d)}
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
