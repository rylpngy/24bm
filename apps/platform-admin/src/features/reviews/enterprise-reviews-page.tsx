import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import {
  usePlatformEnterpriseListPendingReviews,
  usePlatformEnterpriseReview,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, StatusPill } from '@24bid/ui';

// 企业审核:平台对入驻企业(verified=false)做资料确认/风险确认后通过或驳回。
export function EnterpriseReviewsPage() {
  const queryClient = useQueryClient();
  const pending = usePlatformEnterpriseListPendingReviews();
  const review = usePlatformEnterpriseReview();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [forms, setForms] = useState<
    Record<string, { profileConfirmed: boolean; riskConfirmed: boolean; comment: string }>
  >({});

  const reviews = pending.data?.data ?? [];

  const formFor = (id: string) =>
    forms[id] ?? { profileConfirmed: false, riskConfirmed: false, comment: '' };

  const setForm = (id: string, patch: Partial<{ profileConfirmed: boolean; riskConfirmed: boolean; comment: string }>) =>
    setForms((f) => ({ ...f, [id]: { ...formFor(id), ...patch } }));

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).includes('/platform/enterprise-reviews'),
    });

  const submit = (id: string, name: string, verified: boolean) => {
    const form = formFor(id);
    review.mutate(
      {
        enterpriseId: id,
        data: {
          verified,
          reviewStatus: verified ? 'approved' : 'rejected',
          reviewComment: form.comment || undefined,
          profileConfirmed: form.profileConfirmed,
          riskConfirmed: form.riskConfirmed,
        },
      },
      {
        onSuccess: () => {
          setFeedback(`企业「${name}」已${verified ? '审核通过' : '驳回'}`);
          refresh();
        },
      },
    );
  };

  return (
    <Panel title="企业审核" icon={ShieldCheck} subtitle="入驻审核 · 资料确认 · 风险确认">
      <div className="mb-4">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">
          共 {reviews.length} 家待审核
        </span>
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {pending.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载待审核企业…" />
      ) : reviews.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无待审核企业。新企业提交入驻后出现在此。" />
      ) : (
        <div className="space-y-3">
          {reviews.map((e) => {
            const form = formFor(e.id ?? '');
            const busy = review.isPending && review.variables?.enterpriseId === e.id;
            const canApprove = form.profileConfirmed && form.riskConfirmed;
            return (
              <div
                key={e.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">{e.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{e.id}</p>
                  </div>
                  {e.reviewStatus && <StatusPill label={e.reviewStatus} />}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="企业类型" value={e.type ?? '—'} />
                  <MiniFact label="资料确认" value={e.profileConfirmed ? '已确认' : '未确认'} />
                  <MiniFact label="风险确认" value={e.riskConfirmed ? '已确认' : '未确认'} />
                </div>

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">审核确认</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.profileConfirmed}
                        onChange={(ev) => setForm(e.id ?? '', { profileConfirmed: ev.target.checked })}
                      />
                      资料齐全已核验
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.riskConfirmed}
                        onChange={(ev) => setForm(e.id ?? '', { riskConfirmed: ev.target.checked })}
                      />
                      风险与合规已核验
                    </label>
                  </div>
                  <textarea
                    className="mt-2 min-h-[56px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    placeholder="审核意见(选填):如资质齐全、信用良好，同意入驻。"
                    value={form.comment}
                    onChange={(ev) => setForm(e.id ?? '', { comment: ev.target.value })}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => e.id && submit(e.id, e.name ?? '', true)}
                    disabled={busy || !canApprove}
                    className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
                  >
                    {busy ? '处理中' : '审核通过'}
                  </button>
                  <button
                    type="button"
                    onClick={() => e.id && submit(e.id, e.name ?? '', false)}
                    disabled={busy}
                    className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    驳回
                  </button>
                  {!canApprove && (
                    <span className="text-xs font-bold text-slate-400">
                      需勾选资料确认与风险确认后方可通过
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
