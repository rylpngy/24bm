import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useSupplierQuoteListRfqs, useSupplierQuoteSubmit } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

// 询价邀请:供应商查看被邀请的 RFQ,在报价中状态可提交报价(含税额/交期)。
export function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const rfqs = useSupplierQuoteListRfqs();
  const submit = useSupplierQuoteSubmit();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { amount: string; taxRate: string; deliveryDays: string }>>({});

  const list = rfqs.data?.data ?? [];
  const formFor = (id: string) => forms[id] ?? { amount: '', taxRate: '13', deliveryDays: '7' };
  const setForm = (id: string, patch: Partial<{ amount: string; taxRate: string; deliveryDays: string }>) =>
    setForms((f) => ({ ...f, [id]: { ...formFor(id), ...patch } }));

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/rfqs'),
    });

  const onSubmit = (rfqId: string) => {
    const f = formFor(rfqId);
    submit.mutate(
      {
        rfqId,
        data: {
          amount: Number(f.amount) || 0,
          taxRate: Number(f.taxRate) || 0,
          deliveryDays: Number(f.deliveryDays) || 0,
        },
      },
      {
        onSuccess: () => {
          setFeedback(`询价 ${rfqId} 报价已提交`);
          refresh();
        },
      },
    );
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

  return (
    <Panel title="询价邀请" icon={Send} subtitle="可报价商机 · 报价提交">
      <ListToolbar title="询价邀请" recordCount={list.length} filterLabel="全部" actionLabel="被邀请的询价" />
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
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
                    <p className="text-xs font-black text-emerald-800">提交报价</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div>
                        <label className="text-[11px] font-black text-slate-500">报价金额(含税)</label>
                        <input className={inputCls} type="number" value={f.amount} placeholder="0.00"
                          onChange={(e) => setForm(r.id ?? '', { amount: e.target.value })} />
                      </div>
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
                    </div>
                    <PrimaryActionButton onClick={() => r.id && onSubmit(r.id)} busy={busy} pendingLabel="提交中"
                      disabled={!f.amount}>
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
