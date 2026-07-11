import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { History, ShieldCheck } from 'lucide-react';
import {
  type EnterpriseReviewResponse,
  usePlatformEnterpriseAdvance,
  usePlatformEnterpriseEvents,
  usePlatformEnterpriseListPendingReviews,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MetricCard,
  MetricGrid,
  MiniFact,
  Pagination,
  Panel,
  SearchInput,
  StatusPill,
} from '@24bid/ui';

// 阶段中文标签。
const STAGE_LABEL: Record<string, string> = {
  pending: '待初审',
  preliminary: '初审通过',
  approved: '准入通过',
  rejected: '已驳回',
};

// 企业准入审核:多步状态机(待初审 → 初审通过 → 准入通过/驳回)+ 时间线留痕。
const PAGE_SIZE = 6;

export function EnterpriseReviewsPage() {
  const pending = usePlatformEnterpriseListPendingReviews();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const reviews = pending.data?.data ?? [];

  const count = (stage: string) => reviews.filter((e) => (e.reviewStatus ?? 'pending') === stage).length;
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return reviews.filter((e) => {
      if (stageFilter !== 'all' && (e.reviewStatus ?? 'pending') !== stageFilter) return false;
      if (kw && ![e.name, e.id, e.type].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [reviews, stageFilter, keyword]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Panel title="企业审核" icon={ShieldCheck} subtitle="多步准入工作流 · 初审 → 复审 → 准入 · 留痕可追溯">
      <MetricGrid>
        <MetricCard icon={ShieldCheck} label="在审企业" value={String(reviews.length)} hint="待处理总量" tone="blue" />
        <MetricCard icon={History} label="待初审" value={String(count('pending'))} hint="等待第一步核验" tone="amber" />
        <MetricCard icon={ShieldCheck} label="初审通过" value={String(count('preliminary'))} hint="待准入复核" tone="violet" />
        <MetricCard icon={ShieldCheck} label="已驳回" value={String(count('rejected'))} hint="待企业补充重提" tone="rose" />
      </MetricGrid>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          items={[
            { id: 'all', label: '全部', count: reviews.length },
            { id: 'pending', label: '待初审', count: count('pending') },
            { id: 'preliminary', label: '初审通过', count: count('preliminary') },
            { id: 'rejected', label: '已驳回', count: count('rejected') },
          ]}
          value={stageFilter}
          onChange={(id) => { setStageFilter(id); setPage(1); }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按企业名称 / ID / 类型搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }}
        />
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {pending.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载在审企业…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={keyword || stageFilter !== 'all' ? '没有符合条件的在审企业。' : '暂无在审企业。新企业提交入驻后出现在此。'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((e) => (
              <ReviewCard key={e.id} enterprise={e} onDone={setFeedback} />
            ))}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}

function ReviewCard({
  enterprise: e,
  onDone,
}: {
  enterprise: EnterpriseReviewResponse;
  onDone: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const advance = usePlatformEnterpriseAdvance();
  const [comment, setComment] = useState('');
  const [profile, setProfile] = useState(false);
  const [risk, setRisk] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const events = usePlatformEnterpriseEvents(e.id ?? '', {
    query: { enabled: showTimeline && !!e.id },
  });

  const stage = e.reviewStatus ?? 'pending';
  const busy = advance.isPending;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).includes('/platform/enterprise-reviews'),
    });

  const run = (action: string, label: string) => {
    if (!e.id) return;
    advance.mutate(
      {
        enterpriseId: e.id,
        data: { action, comment: comment || undefined, profileConfirmed: profile, riskConfirmed: risk },
      },
      {
        onSuccess: () => {
          onDone(`企业「${e.name}」已${label}`);
          setComment('');
          refresh();
        },
      },
    );
  };

  const needReason = comment.trim().length === 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-black text-slate-950">{e.name}</p>
          <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{e.id}</p>
        </div>
        <StatusPill label={STAGE_LABEL[stage] ?? stage} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniFact label="企业类型" value={e.type ?? '—'} />
        <MiniFact label="资料确认" value={e.profileConfirmed ? '已确认' : '未确认'} />
        <MiniFact label="风险确认" value={e.riskConfirmed ? '已确认' : '未确认'} />
      </div>

      {stage === 'preliminary' && (
        <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={profile} onChange={(ev) => setProfile(ev.target.checked)} />
            资料齐全已核验
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={risk} onChange={(ev) => setRisk(ev.target.checked)} />
            风险与合规已核验
          </label>
        </div>
      )}

      <textarea
        className="mt-3 min-h-[52px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        placeholder="审核意见 / 驳回·退回理由(驳回与退回必填)"
        value={comment}
        onChange={(ev) => setComment(ev.target.value)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {stage === 'pending' && (
          <button
            type="button"
            onClick={() => run('preliminary_pass', '初审通过')}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {busy ? '处理中' : '初审通过'}
          </button>
        )}
        {stage === 'preliminary' && (
          <button
            type="button"
            onClick={() => run('approve', '准入通过')}
            disabled={busy || !(profile && risk)}
            className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {busy ? '处理中' : '准入通过'}
          </button>
        )}
        {stage === 'preliminary' && (
          <button
            type="button"
            onClick={() => run('return', '退回补充')}
            disabled={busy || needReason}
            className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-white px-4 text-xs font-black text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
          >
            退回补充
          </button>
        )}
        <button
          type="button"
          onClick={() => run('reject', '驳回')}
          disabled={busy || needReason}
          className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          驳回
        </button>
        {stage === 'preliminary' && !(profile && risk) && (
          <span className="text-[11px] font-bold text-slate-400">准入通过需勾选资料与风险确认</span>
        )}
        {needReason && (
          <span className="text-[11px] font-bold text-slate-400">驳回 / 退回需先填写理由</span>
        )}
        <button
          type="button"
          onClick={() => setShowTimeline((s) => !s)}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-500 transition hover:bg-slate-50"
        >
          <History size={13} /> {showTimeline ? '收起时间线' : '审核时间线'}
        </button>
      </div>

      {advance.isError && (
        <p className="mt-2 text-xs font-bold text-red-600">操作失败:请检查阶段是否允许该动作、必填理由是否填写。</p>
      )}

      {showTimeline && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          {events.isLoading ? (
            <p className="text-xs font-bold text-slate-400">加载时间线…</p>
          ) : (events.data?.data ?? []).length === 0 ? (
            <p className="text-xs font-bold text-slate-400">暂无审核流转记录。</p>
          ) : (
            <ol className="space-y-2">
              {(events.data?.data ?? []).map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0">
                    <p className="font-black text-slate-700">
                      {ev.fromStatusLabel} → {ev.toStatusLabel}
                    </p>
                    {ev.comment && <p className="mt-0.5 font-semibold text-slate-500">{ev.comment}</p>}
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                      {ev.actorId} · {ev.createdAt?.slice(0, 19).replace('T', ' ')}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
