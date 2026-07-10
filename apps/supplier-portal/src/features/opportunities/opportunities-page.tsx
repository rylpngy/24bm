import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Trash2 } from 'lucide-react';
import {
  type RfqResponse,
  useSupplierQuoteDecline,
  useSupplierQuoteListList,
  useSupplierQuoteListRfqs,
  useSupplierQuoteMarkViewed,
  useSupplierQuoteSubmit,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Pagination, Panel, PrimaryActionButton, SearchInput, StatusPill, cn } from '@24bid/ui';
import { RfqClarificationsSupplier } from './rfq-clarifications-supplier';
import { RfqResultSupplier } from './rfq-result-supplier';
import { useAuthStore } from '../../lib/auth-store';

interface LineRow {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

interface QuoteForm {
  taxRate: string;
  deliveryDays: string;
  lines: LineRow[];
}

const emptyLine = (): LineRow => ({ description: '', unit: '台', quantity: '', unitPrice: '' });
const defaultForm = (): QuoteForm => ({ taxRate: '13', deliveryDays: '7', lines: [emptyLine()] });

const currency = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const lineAmount = (l: LineRow) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
const formTotal = (f: QuoteForm) => f.lines.reduce((sum, l) => sum + lineAmount(l), 0);

// 询比邀请:供应商在报价中状态按行报价(描述/单位/数量/单价),报价金额按行汇总。
export function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const supplierId = useAuthStore((s) => s.session?.supplierId ?? '');
  // 竞价进行中时自动轮询(5s),让当前最低价/截止顺延即时可见;无在场竞价则不轮询。
  const rfqs = useSupplierQuoteListRfqs(undefined, {
    query: {
      refetchInterval: (query) =>
        ((query.state.data?.data ?? []) as RfqResponse[]).some(
          (r) => r.method === '竞价' && r.status === '报价中',
        )
          ? 5_000
          : false,
    },
  });
  const myQuotes = useSupplierQuoteListList();
  const submit = useSupplierQuoteSubmit();
  const markViewed = useSupplierQuoteMarkViewed();
  const decline = useSupplierQuoteDecline();
  // 已读回执:进入商机列表即视为查看,幂等且每个询价只上报一次。
  const viewedOnce = useRef(new Set<string>());
  const rfqData = rfqs.data?.data ?? [];
  useEffect(() => {
    rfqData.forEach((r) => {
      const mine = (r.invitations ?? [])[0];
      if (r.id && r.status === '报价中' && mine && !mine.viewedAt && !viewedOnce.current.has(r.id)) {
        viewedOnce.current.add(r.id);
        markViewed.mutate({ rfqId: r.id });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqData.length]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, QuoteForm>>({});
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = rfqs.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((r) => r.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((r) => {
    if (statusFilter !== '全部' && r.status !== statusFilter) return false;
    if (!kw) return true;
    return [r.title, r.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((r) => r.status === s).length);
  const PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const formFor = (id: string) => forms[id] ?? defaultForm();
  const setForm = (id: string, patch: Partial<QuoteForm>) =>
    setForms((f) => ({ ...f, [id]: { ...formFor(id), ...patch } }));
  const setLine = (id: string, idx: number, patch: Partial<LineRow>) => {
    const f = formFor(id);
    const lines = f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setForm(id, { lines });
  };
  const addLine = (id: string) => setForm(id, { lines: [...formFor(id).lines, emptyLine()] });
  const removeLine = (id: string, idx: number) => {
    const lines = formFor(id).lines.filter((_, i) => i !== idx);
    setForm(id, { lines: lines.length ? lines : [emptyLine()] });
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/rfqs'),
    });

  const validLines = (f: QuoteForm) =>
    f.lines.filter((l) => l.description.trim() && Number(l.quantity) > 0 && Number(l.unitPrice) > 0);

  const onSubmit = (rfqId: string) => {
    const f = formFor(rfqId);
    const lines = validLines(f);
    submit.mutate(
      {
        rfqId,
        data: {
          amount: formTotal(f),
          taxRate: Number(f.taxRate) || 0,
          deliveryDays: Number(f.deliveryDays) || 0,
          lineItems: lines.map((l) => ({
            description: l.description.trim(),
            unit: l.unit.trim() || '项',
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
          })),
        },
      },
      {
        onSuccess: () => {
          setFeedback(`询比 ${rfqId} 报价已提交（${lines.length} 个行项，合计 ${currency(formTotal(f))}）`);
          setForms((s) => ({ ...s, [rfqId]: defaultForm() }));
          setError(null);
          refresh();
        },
        onError: () => {
          setError(`询比 ${rfqId} 报价提交失败：可能已提交过报价或询比已截止。`);
        },
      },
    );
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

  return (
    <Panel title="询比邀请" icon={Send} subtitle="可报价商机 · 按行报价">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === statusFilter
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {s !== '全部' && statusCount(s) > 0 && <span className="ml-1 text-slate-400">{statusCount(s)}</span>}
            </button>
          ))}
        </div>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按询比标题 / 编号搜索"
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

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载询比邀请…" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的询比。'
              : '暂无询比邀请。被采购方邀请后出现在此。'
          }
        />
      ) : (
        <>
        <div className="space-y-3">
          {pageItems.map((r, i) => {
            const f = formFor(r.id ?? '');
            const myInvitation = (r.invitations ?? [])[0];
            const declined = myInvitation?.inviteStatus === '已拒绝';
            const quoting = r.status === '报价中' && !declined;
            const busy = submit.isPending && submit.variables?.rfqId === r.id;
            const total = formTotal(f);
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}.
                      </span>
                      {r.title}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{r.id}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(r.currentRound ?? 1) > 1 && (
                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-700">
                        第{r.currentRound}轮{r.finalRound ? '·最终' : ''}
                      </span>
                    )}
                    {r.status && <StatusPill label={r.status} />}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="报价截止" value={r.deadlineAt?.slice(0, 10) ?? '—'} />
                  <MiniFact label="评选方式" value={r.evaluationMethod ?? '最低价'} />
                  <MiniFact label="已提交报价" value={String((r.quotes ?? []).length)} />
                </div>

                {r.method === '竞价' && (() => {
                  const myBid = (myQuotes.data?.data ?? []).find(
                    (q) => q.rfqId === r.id && q.amount != null,
                  );
                  const leading =
                    myBid?.amount != null
                    && r.auctionLowestAmount != null
                    && myBid.amount <= r.auctionLowestAmount;
                  const remainingMs = r.deadlineAt ? new Date(r.deadlineAt).getTime() - Date.now() : null;
                  const remainingText =
                    remainingMs == null
                      ? '—'
                      : remainingMs <= 0
                        ? '已截止'
                        : remainingMs < 3_600_000
                          ? `${Math.ceil(remainingMs / 60_000)} 分钟`
                          : `${Math.floor(remainingMs / 3_600_000)} 小时`;
                  return (
                    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px] font-bold text-amber-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          竞价项目:起拍价 ¥{r.auctionStartPrice?.toLocaleString('zh-CN') ?? '—'}
                          {' · '}当前最低报价 {r.auctionLowestAmount != null ? `¥${r.auctionLowestAmount.toLocaleString('zh-CN')}` : '暂无出价'}
                          {' · '}本次出价上限 ¥{(
                            r.auctionLowestAmount != null
                              ? r.auctionLowestAmount - (r.auctionMinDecrement ?? 0)
                              : r.auctionStartPrice ?? 0
                          ).toLocaleString('zh-CN')}
                          {' · '}剩余 {remainingText}(临近截止的出价将自动顺延)
                        </span>
                        {myBid?.amount != null && (
                          <span
                            className={`rounded-md px-2 py-0.5 font-black ${
                              leading ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {leading ? '当前领先' : '已被超越'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(r.quoteRequirement || r.deliveryRequirement) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-black text-slate-400">报价要求</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                        {r.quoteRequirement || '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-black text-slate-400">交付要求</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                        {r.deliveryRequirement || '—'}
                      </p>
                    </div>
                  </div>
                )}

                {r.status === '已定标' && r.id && supplierId && (
                  <RfqResultSupplier rfqId={r.id} supplierId={supplierId} />
                )}

                {declined && (
                  <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-xs font-black text-red-700">
                    已拒绝参与本次询价{myInvitation?.declineReason ? `:${myInvitation.declineReason}` : ''}。
                  </div>
                )}
                {r.status === '报价中' && !declined && !(r.quotes ?? []).length && (
                  <button
                    type="button"
                    disabled={decline.isPending}
                    onClick={() => {
                      const reason = window.prompt('确认拒绝参与本次询价?可填写原因(选填):');
                      if (reason === null) return;
                      r.id &&
                        decline.mutate(
                          { rfqId: r.id, data: { reason: reason || undefined } },
                          { onSuccess: refresh, onError: () => setError('拒绝失败:可能已提交报价。') },
                        );
                    }}
                    className="mt-3 inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    拒绝参与
                  </button>
                )}
                {r.id && <RfqClarificationsSupplier rfqId={r.id} canAsk={quoting} />}

                {quoting ? (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-emerald-800">按行报价</p>
                      <button type="button" onClick={() => addLine(r.id ?? '')}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-50">
                        <Plus size={13} /> 添加行
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {f.lines.map((l, idx) => (
                        <div key={idx} className="grid grid-cols-12 items-end gap-2">
                          <div className="col-span-12 sm:col-span-4">
                            {idx === 0 && <label className="text-[10px] font-black text-slate-500">品名/规格</label>}
                            <input className={inputCls} value={l.description} placeholder="如:机架式服务器"
                              onChange={(e) => setLine(r.id ?? '', idx, { description: e.target.value })} />
                          </div>
                          <div className="col-span-3 sm:col-span-1">
                            {idx === 0 && <label className="text-[10px] font-black text-slate-500">单位</label>}
                            <input className={inputCls} value={l.unit}
                              onChange={(e) => setLine(r.id ?? '', idx, { unit: e.target.value })} />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            {idx === 0 && <label className="text-[10px] font-black text-slate-500">数量</label>}
                            <input className={inputCls} type="number" value={l.quantity} placeholder="0"
                              onChange={(e) => setLine(r.id ?? '', idx, { quantity: e.target.value })} />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            {idx === 0 && <label className="text-[10px] font-black text-slate-500">单价</label>}
                            <input className={inputCls} type="number" value={l.unitPrice} placeholder="0.00"
                              onChange={(e) => setLine(r.id ?? '', idx, { unitPrice: e.target.value })} />
                          </div>
                          <div className="col-span-2 sm:col-span-2">
                            {idx === 0 && <label className="text-[10px] font-black text-slate-500">行金额</label>}
                            <p className="truncate py-2 text-right text-xs font-black text-slate-700">
                              {currency(lineAmount(l))}
                            </p>
                          </div>
                          <div className="col-span-1 flex justify-end pb-1">
                            <button type="button" onClick={() => removeLine(r.id ?? '', idx)}
                              className="text-slate-300 hover:text-red-500" aria-label="删除行">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div>
                        <label className="text-[11px] font-black text-slate-500">税率(%)</label>
                        <input className={inputCls} type="number" value={f.taxRate}
                          onChange={(e) => setForm(r.id ?? '', { taxRate: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-500">交期(天)</label>
                        <input className={inputCls} type="number" value={f.deliveryDays}
                          onChange={(e) => setForm(r.id ?? '', { deliveryDays: e.target.value })} />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="text-[11px] font-black text-slate-500">报价合计(含税)</label>
                        <p className="py-2 text-lg font-black text-emerald-700">{currency(total)}</p>
                      </div>
                    </div>

                    <PrimaryActionButton onClick={() => r.id && onSubmit(r.id)} busy={busy} pendingLabel="提交中"
                      disabled={validLines(f).length === 0}>
                      提交报价
                    </PrimaryActionButton>
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-bold text-slate-400">
                    当前状态「{r.status}」,报价入口仅在报价中开放。
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
