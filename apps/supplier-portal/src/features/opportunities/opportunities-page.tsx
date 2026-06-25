import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Trash2 } from 'lucide-react';
import { useSupplierQuoteListRfqs, useSupplierQuoteSubmit } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

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

// 询价邀请:供应商在报价中状态按行报价(描述/单位/数量/单价),报价金额按行汇总。
export function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const rfqs = useSupplierQuoteListRfqs();
  const submit = useSupplierQuoteSubmit();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, QuoteForm>>({});

  const list = rfqs.data?.data ?? [];
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
          setFeedback(`询价 ${rfqId} 报价已提交（${lines.length} 个行项，合计 ${currency(formTotal(f))}）`);
          setForms((s) => ({ ...s, [rfqId]: defaultForm() }));
          setError(null);
          refresh();
        },
        onError: () => {
          setError(`询价 ${rfqId} 报价提交失败：可能已提交过报价或询价已截止。`);
        },
      },
    );
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

  return (
    <Panel title="询价邀请" icon={Send} subtitle="可报价商机 · 按行报价">
      <ListToolbar title="询价邀请" recordCount={list.length} filterLabel="全部" actionLabel="被邀请的询价" />
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
        <FeedbackNotice tone="info" message="正在加载询价邀请…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无询价邀请。被采购方邀请后出现在此。" />
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const f = formFor(r.id ?? '');
            const quoting = r.status === '报价中';
            const busy = submit.isPending && submit.variables?.rfqId === r.id;
            const total = formTotal(f);
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">{r.title}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{r.id}</p>
                  </div>
                  {r.status && <StatusPill label={r.status} />}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="报价截止" value={r.deadlineAt?.slice(0, 10) ?? '—'} />
                  <MiniFact label="评选方式" value={r.evaluationMethod ?? '最低价'} />
                  <MiniFact label="已提交报价" value={String((r.quotes ?? []).length)} />
                </div>

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
      )}
    </Panel>
  );
}
