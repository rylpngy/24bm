import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  Undo2,
  XCircle,
} from 'lucide-react';
import {
  type EnterpriseReviewResponse,
  usePlatformEnterpriseAdvance,
  usePlatformEnterpriseEvents,
  usePlatformEnterpriseListPendingReviews,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

const STAGE_LABEL: Record<string, string> = {
  pending: '待初审',
  preliminary: '初审通过',
  approved: '准入通过',
  rejected: '已驳回',
};

const STAGE_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  preliminary: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
};

const TYPE_LABEL: Record<string, string> = { supplier: '供应商', buyer: '采购方', platform: '平台' };

const inputCls =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function stageOf(e: EnterpriseReviewResponse) {
  return e.reviewStatus ?? 'pending';
}

// 企业审核中心:样式与布局对齐采购端「智能审批」——汇总卡 + 筛选表格 + 二级审核详情页。
export function EnterpriseReviewsPage() {
  const pending = usePlatformEnterpriseListPendingReviews();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('全部阶段');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reviews = pending.data?.data ?? [];
  const count = (stage: string) => reviews.filter((e) => stageOf(e) === stage).length;

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return reviews.filter((e) => {
      if (stageFilter !== '全部阶段' && STAGE_LABEL[stageOf(e)] !== stageFilter) return false;
      if (kw && ![e.name, e.id, e.type].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [reviews, stageFilter, keyword]);

  const selected = reviews.find((e) => e.id === selectedId);
  if (selected) {
    return (
      <ReviewDetailPage
        enterprise={selected}
        onBack={() => setSelectedId(null)}
        onDone={(msg) => {
          setFeedback(msg);
          setSelectedId(null);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <h1 className="text-base font-black text-slate-950">企业审核中心</h1>
        <p className="mt-2 text-sm font-bold text-slate-500">
          集中处理企业入驻准入审核:待初审 → 初审通过 → 准入通过 / 驳回,全程留痕可追溯
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <SummaryCard icon={ShieldCheck} tone="blue" label="在审企业" value={String(reviews.length)} unit="家待处理" />
        <SummaryCard icon={Clock3} tone="amber" label="待初审" value={String(count('pending'))} unit="家等待核验" />
        <SummaryCard icon={CheckCircle2} tone="emerald" label="初审通过" value={String(count('preliminary'))} unit="家待准入复核" />
      </div>

      {feedback && <FeedbackNotice tone="success" message={feedback} />}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <select className={inputCls} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option>全部阶段</option>
            {Object.values(STAGE_LABEL).map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
          <div className="relative w-full lg:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className={cn(inputCls, 'w-full pl-9 font-semibold')}
              placeholder="搜索企业名称或 ID"
            />
          </div>
        </div>

        {pending.isLoading ? (
          <div className="p-5">
            <FeedbackNotice tone="info" message="正在加载在审企业…" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <FeedbackNotice
              tone="info"
              message={keyword || stageFilter !== '全部阶段' ? '暂无符合条件的在审企业。' : '暂无在审企业。新企业提交入驻后出现在此。'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-6 py-4">序号</th>
                  <th className="px-4 py-4">企业</th>
                  <th className="px-4 py-4">企业类型</th>
                  <th className="px-4 py-4">核验进度</th>
                  <th className="px-4 py-4">当前阶段</th>
                  <th className="px-6 py-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e, index) => {
                  const stage = stageOf(e);
                  return (
                    <tr key={e.id} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-5 text-sm font-black text-slate-400">{index + 1}</td>
                      <td className="px-4 py-5">
                        <p className="font-black text-slate-950">{e.name}</p>
                        <p className="mt-1 font-mono text-xs font-bold text-slate-400">{e.id}</p>
                      </td>
                      <td className="px-4 py-5">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                          {TYPE_LABEL[e.type ?? ''] ?? e.type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <div className={cn('flex items-center gap-1 text-xs font-black', e.profileConfirmed && e.riskConfirmed ? 'text-emerald-600' : 'text-amber-600')}>
                          {e.profileConfirmed && e.riskConfirmed ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                          资料{e.profileConfirmed ? '已' : '未'}核 · 风险{e.riskConfirmed ? '已' : '未'}核
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', STAGE_TONE[stage] ?? 'bg-slate-100 text-slate-600')}>
                          {STAGE_LABEL[stage] ?? stage}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() => setSelectedId(e.id ?? null)}
                          className="text-sm font-black text-blue-600 hover:text-blue-700"
                        >
                          审核
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  unit,
}: {
  icon: typeof ShieldCheck;
  tone: 'blue' | 'amber' | 'emerald';
  label: string;
  value: string;
  unit: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  } as const;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[tone])}>
          <Icon size={18} />
        </span>
        <div>
          <p className="text-xs font-black text-slate-400">{label}</p>
          <p className="mt-0.5 font-mono text-xl font-black text-slate-950">
            {value} <span className="font-sans text-xs font-bold text-slate-400">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// 二级审核详情页:企业信息 + 审核操作 + 流转日志 + 合规检查侧栏,布局对齐智能审批详情页。
function ReviewDetailPage({
  enterprise: e,
  onBack,
  onDone,
}: {
  enterprise: EnterpriseReviewResponse;
  onBack: () => void;
  onDone: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const advance = usePlatformEnterpriseAdvance();
  const events = usePlatformEnterpriseEvents(e.id ?? '', { query: { enabled: !!e.id } });
  const [comment, setComment] = useState('');
  const [profile, setProfile] = useState(!!e.profileConfirmed);
  const [risk, setRisk] = useState(!!e.riskConfirmed);

  const stage = stageOf(e);
  const busy = advance.isPending;
  const needReason = comment.trim().length === 0;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/platform/enterprise-reviews'),
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
          refresh();
          onDone(`企业「${e.name}」已${label}`);
        },
      },
    );
  };

  const eventList = events.data?.data ?? [];
  const checks = [
    {
      title: '资料完备性',
      desc: profile ? '入驻资料已人工核验完备' : '资料尚未核验,准入通过前必须完成',
      ok: profile,
    },
    {
      title: '风险与合规',
      desc: risk ? '风险与合规筛查已确认' : '风险筛查未确认,准入通过前必须完成',
      ok: risk,
    },
    {
      title: '审核意见留痕',
      desc: comment.trim() ? '本次操作将附审核意见' : '驳回 / 退回必须填写理由,通过建议附意见',
      ok: !!comment.trim(),
    },
    {
      title: '阶段合法性',
      desc: `当前阶段「${STAGE_LABEL[stage] ?? stage}」,可执行动作见右上角按钮`,
      ok: stage !== 'rejected',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={onBack} className="text-slate-400 hover:text-slate-700" aria-label="返回列表">
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-base font-black text-slate-950">{e.name}</h1>
                <span className={cn('rounded-full px-2 py-1 text-[11px] font-black', STAGE_TONE[stage] ?? 'bg-slate-100 text-slate-600')}>
                  {STAGE_LABEL[stage] ?? stage}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                企业 ID: {e.id} · 类型: {TYPE_LABEL[e.type ?? ''] ?? e.type ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => run('reject', '驳回')}
              disabled={busy || needReason}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={15} /> 驳回
            </button>
            {stage === 'preliminary' && (
              <button
                type="button"
                onClick={() => run('return', '退回补充')}
                disabled={busy || needReason}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-xs font-black text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                <Undo2 size={15} /> 退回补充
              </button>
            )}
            {stage === 'pending' && (
              <button
                type="button"
                onClick={() => run('preliminary_pass', '初审通过')}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-400"
              >
                <CheckCircle2 size={15} /> {busy ? '处理中' : '初审通过'}
              </button>
            )}
            {stage === 'preliminary' && (
              <button
                type="button"
                onClick={() => run('approve', '准入通过')}
                disabled={busy || !(profile && risk)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                <CheckCircle2 size={15} /> {busy ? '处理中' : '准入通过'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <SectionTitle icon={FileText} title="企业信息" />
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-base font-black text-slate-950">入驻申请(来自企业提交)</p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <Info label="企业名称" value={e.name ?? '—'} />
                <Info label="企业 ID" value={e.id ?? '—'} />
                <Info label="企业类型" value={TYPE_LABEL[e.type ?? ''] ?? e.type ?? '—'} />
                <Info label="平台认证" value={e.verified ? '已认证' : '未认证'} />
                <Info label="资料核验" value={e.profileConfirmed ? '已核验' : '未核验'} />
                <Info label="风险核验" value={e.riskConfirmed ? '已核验' : '未核验'} />
              </div>
              {e.reviewComment && (
                <p className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold text-slate-600">
                  最近审核意见:{e.reviewComment}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <SectionTitle icon={ShieldCheck} title="审核操作" />
            {stage === 'preliminary' && (
              <div className="mt-4 flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
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
              className="mt-4 min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="审核意见 / 驳回·退回理由(驳回与退回必填)"
              value={comment}
              onChange={(ev) => setComment(ev.target.value)}
            />
            <div className="mt-2 space-y-1 text-[11px] font-bold text-slate-400">
              {stage === 'preliminary' && !(profile && risk) && <p>· 准入通过需勾选资料与风险两项核验</p>}
              {needReason && <p>· 驳回 / 退回需先填写理由</p>}
            </div>
            {advance.isError && (
              <p className="mt-2 text-xs font-bold text-red-600">操作失败:请检查阶段是否允许该动作、必填理由是否填写。</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <SectionTitle icon={Clock3} title="审核流转日志" />
            {events.isLoading ? (
              <p className="mt-4 text-xs font-bold text-slate-400">加载时间线…</p>
            ) : eventList.length === 0 ? (
              <p className="mt-4 text-xs font-bold text-slate-400">暂无流转记录,企业提交入驻后从「待初审」开始。</p>
            ) : (
              <div className="mt-6 space-y-7 border-l border-slate-200 pl-5">
                {eventList.map((ev, index) => (
                  <div key={ev.id ?? index} className="relative">
                    <span className={cn('absolute -left-[25px] top-1 h-2 w-2 rounded-full', index === 0 ? 'bg-blue-600' : 'bg-emerald-500')} />
                    <p className="font-black text-slate-950">
                      {ev.fromStatusLabel} → {ev.toStatusLabel}
                    </p>
                    {ev.comment && <p className="mt-1 text-sm font-bold text-slate-500">{ev.comment}</p>}
                    <span className="mt-2 inline-flex rounded-lg bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                      {ev.actorId} · {ev.createdAt?.slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg bg-slate-900 p-4 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <p className="text-base font-black">准入合规检查</p>
                  <p className="font-mono text-[11px] font-black text-blue-200">基于审核数据逐条核对</p>
                </div>
              </div>
              <span className={cn('rounded-md px-2 py-1 text-xs font-black', checks.every((c) => c.ok) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300')}>
                {checks.filter((c) => c.ok).length}/{checks.length} 项通过
              </span>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              {checks.map((check) => (
                <div key={check.title} className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start gap-3">
                    {check.ok ? (
                      <CheckCircle2 size={15} className="mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle size={15} className="mt-0.5 text-amber-300" />
                    )}
                    <div>
                      <p className="text-sm font-black text-white">{check.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{check.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] font-bold text-slate-400">
              以上为系统按审核数据的规则核对结果,最终准入决定以人工判断为准。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={18} className="text-blue-600" />
      <h2 className="text-base font-black text-slate-950">{title}</h2>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
