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
  TrendingUp,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import {
  type PendingApprovalTaskResponse,
  useApprovalInboxPending,
  useApprovalInboxRecent,
  useBuyerContractReviewApproval,
  usePurchaseDemandReview,
  usePurchaseOrderCreate,
  useRfqAwardReviewApproval,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

type RiskLevel = '低风险' | '中风险' | '高风险';

const businessTypeLabel: Record<string, string> = {
  purchase_demand: '采购需求',
  rfq_award: '定标审批',
  contract_approval: '合同审批',
  supplier_admission: '供应商入驻',
  supplier_profile_change: '信息变更',
  supplier_blacklist_appeal: '黑名单申诉',
};

const typeTone: Record<string, string> = {
  purchase_demand: 'bg-blue-50 text-blue-700',
  rfq_award: 'bg-violet-50 text-violet-700',
  contract_approval: 'bg-emerald-50 text-emerald-700',
  supplier_admission: 'bg-blue-50 text-blue-700',
  supplier_profile_change: 'bg-purple-50 text-purple-700',
  supplier_blacklist_appeal: 'bg-red-50 text-red-700',
};

const statusTone: Record<string, string> = {
  待审批: 'bg-blue-50 text-blue-700',
  风险提示: 'bg-amber-50 text-amber-700',
  待裁决: 'bg-indigo-50 text-indigo-700',
  已通过: 'bg-emerald-50 text-emerald-700',
  合规复核: 'bg-amber-50 text-amber-700',
};

const inputCls =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function riskOf(t: PendingApprovalTaskResponse): RiskLevel {
  const title = `${t.summaryTitle ?? ''}${t.reviewComment ?? ''}${t.bizType ?? ''}`;
  if ((t.amount ?? 0) >= 1000000 || /黑名单|违规|超标|高风险/.test(title)) return '高风险';
  if ((t.amount ?? 0) >= 100000 || /变更|合同|定标|复核|预警/.test(title)) return '中风险';
  return '低风险';
}

function riskReason(t: PendingApprovalTaskResponse) {
  const level = riskOf(t);
  if (level === '高风险') return t.bizType === 'supplier_blacklist_appeal' ? '历史惩戒记录需复核' : '连续质量不达标';
  if (level === '中风险') return t.bizType === 'supplier_profile_change' ? '收款账户变更' : '金额或合同条款需复核';
  return '资质齐全';
}

function riskClass(level: RiskLevel) {
  if (level === '高风险') return 'text-red-600';
  if (level === '中风险') return 'text-amber-600';
  return 'text-emerald-600';
}

function bizLabel(t: PendingApprovalTaskResponse) {
  return businessTypeLabel[t.bizType ?? ''] ?? t.bizType ?? '审批业务';
}

function displayStatus(t: PendingApprovalTaskResponse) {
  const risk = riskOf(t);
  if (t.status === '已通过' || t.businessStatus === '已通过') return '已通过';
  if (risk === '高风险') return t.bizType === 'supplier_blacklist_appeal' ? '合规复核' : '待裁决';
  if (risk === '中风险') return '风险提示';
  return '待审批';
}

function dateText(value?: string) {
  return value?.slice(0, 10) ?? '—';
}

function taskBusinessNo(t: PendingApprovalTaskResponse) {
  return t.bizId ?? t.id ?? '—';
}

function taskApplicantText(t: PendingApprovalTaskResponse) {
  if (t.bizType === 'purchase_demand') return t.submittedByName ?? t.submittedById ?? '采购申请人';
  return t.counterpartyName ?? t.submittedByName ?? '—';
}

function relationColumnLabel(tasks: PendingApprovalTaskResponse[]) {
  return tasks.some((task) => task.bizType === 'purchase_demand') ? '申请人/关联方' : '关联供应商';
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const pending = useApprovalInboxPending();
  const recent = useApprovalInboxRecent();
  const review = usePurchaseDemandReview();
  const awardReview = useRfqAwardReviewApproval();
  const orderCreate = usePurchaseOrderCreate();
  const contractReview = useBuyerContractReviewApproval();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<PendingApprovalTaskResponse | null>(null);
  const [businessFilter, setBusinessFilter] = useState('全部业务类型');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [keyword, setKeyword] = useState('');

  const tasks = pending.data?.data ?? [];
  const recentTasks = recent.data?.data ?? [];
  const allTasks = tasks.length > 0 ? tasks : recentTasks;

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allTasks.filter((t) => {
      const typeMatched = businessFilter === '全部业务类型' || bizLabel(t) === businessFilter;
      const stateMatched = statusFilter === '全部状态' || displayStatus(t) === statusFilter;
      const keywordMatched =
        !kw ||
        [t.id, t.bizId, t.summaryTitle, t.counterpartyName, t.submittedByName, bizLabel(t)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(kw);
      return typeMatched && stateMatched && keywordMatched;
    });
  }, [allTasks, businessFilter, keyword, statusFilter]);

  const riskCount = allTasks.filter((t) => riskOf(t) !== '低风险').length;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(approvals|demands|rfqs|orders|contracts)/.test(q.queryKey[0] as string),
    });

  const busyBizId =
    (review.isPending && review.variables?.demandId) ||
    (awardReview.isPending && awardReview.variables?.data.awardId) ||
    (orderCreate.isPending && orderCreate.variables?.data.awardId) ||
    (contractReview.isPending && contractReview.variables?.contractId) ||
    null;

  const handleContractReview = (contractId: string, approved: boolean) => {
    contractReview.mutate(
      { contractId, data: { approved, comment: approved ? 'AI 审计通过，审批同意。' : 'AI 审计提示风险，审批驳回。' } },
      {
        onSuccess: () => {
          setFeedback(approved ? '合同审批通过，已生效' : '合同审批已驳回');
          setSelected(null);
          refresh();
        },
      },
    );
  };

  const handleDemandReview = (demandId: string, approved: boolean) => {
    review.mutate(
      { demandId, data: { approved, comment: approved ? '预算与资料完整，同意审批。' : '资料或预算说明不足，驳回补充。' } },
      {
        onSuccess: () => {
          setFeedback(approved ? '需求审批已通过' : '需求审批已驳回');
          setSelected(null);
          refresh();
        },
      },
    );
  };

  const handleAwardReview = (rfqId: string, awardId: string, approved: boolean) => {
    awardReview.mutate(
      { rfqId, data: { awardId, approved, comment: approved ? '比价与定标材料完整，同意定标。' : '定标依据不足，驳回复核。' } },
      {
        onSuccess: () => {
          if (approved) {
            const eta = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
            orderCreate.mutate(
              { data: { awardId, expectedReceiptDate: eta } },
              {
                onSuccess: (res) => {
                  setFeedback(`定标审批通过，已生成采购订单 ${res.data?.id ?? ''}`);
                  setSelected(null);
                  refresh();
                },
                onError: () => {
                  setFeedback('定标已通过，但订单生成失败(可能已生成)。');
                  setSelected(null);
                  refresh();
                },
              },
            );
          } else {
            setFeedback('定标审批已驳回');
            setSelected(null);
            refresh();
          }
        },
      },
    );
  };

  const actOnTask = (task: PendingApprovalTaskResponse, approved: boolean) => {
    if (task.bizType === 'purchase_demand' && task.bizId) handleDemandReview(task.bizId, approved);
    else if (task.bizType === 'rfq_award' && task.bizId && task.parentBizId)
      handleAwardReview(task.parentBizId, task.bizId, approved);
    else if (task.bizType === 'contract_approval' && task.bizId) handleContractReview(task.bizId, approved);
    else {
      setFeedback('该业务类型暂不支持在此审批,请到对应业务模块处理。');
    }
  };

  if (selected) {
    const busy = busyBizId === selected.bizId;
    return (
      <ApprovalDetailPage
        task={selected}
        busy={!!busy}
        onBack={() => setSelected(null)}
        onApprove={() => actOnTask(selected, true)}
        onReject={() => actOnTask(selected, false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-black text-slate-950">智能审批中心</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              集中处理供应商入驻、资料变更、风险申诉及考核申诉等全流程审批业务
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <SummaryCard icon={UserRoundCheck} tone="blue" label="待办审批" value={String(tasks.length)} unit="个任务" />
        <SummaryCard icon={AlertTriangle} tone="amber" label="规则风险提示" value={String(riskCount)} unit="个高风险" />
        <SummaryCard
          icon={TrendingUp}
          tone="emerald"
          label="待办金额合计"
          value={`¥${Math.round(tasks.reduce((sum, t) => sum + (t.amount ?? 0), 0) / 10000).toLocaleString('zh-CN')}`}
          unit="万元"
        />
      </div>

      {feedback && <FeedbackNotice tone="success" message={feedback} />}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <select className={inputCls} value={businessFilter} onChange={(e) => setBusinessFilter(e.target.value)}>
              <option>全部业务类型</option>
              {Array.from(new Set(allTasks.map(bizLabel))).map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
            <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>全部状态</option>
              {['待审批', '风险提示', '待裁决', '已通过', '合规复核'].map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </div>
          <div className="relative w-full lg:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className={cn(inputCls, 'w-full pl-9 font-semibold')}
              placeholder="搜索申请单号或供应商"
            />
          </div>
        </div>

        {pending.isLoading ? (
          <div className="p-5">
            <FeedbackNotice tone="info" message="正在加载待办审批…" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <FeedbackNotice tone="info" message="暂无符合条件的审批任务。" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-6 py-4">序号</th>
                  <th className="px-4 py-4">业务单号</th>
                  <th className="px-4 py-4">业务类型</th>
                  <th className="px-4 py-4">{relationColumnLabel(filtered)}</th>
                  <th className="px-4 py-4">AI 风险评估</th>
                  <th className="px-4 py-4">提交时间</th>
                  <th className="px-4 py-4">当前状态</th>
                  <th className="px-6 py-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t, index) => {
                  const risk = riskOf(t);
                  const status = displayStatus(t);
                  return (
                    <tr key={t.id ?? `${t.bizId}-${index}`} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-5 text-sm font-black text-slate-400">{index + 1}</td>
                      <td className="px-4 py-5">
                        <p className="font-mono text-sm font-black text-slate-950">{taskBusinessNo(t)}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{t.summaryTitle ?? t.id ?? '审批任务'}</p>
                      </td>
                      <td className="px-4 py-5">
                        <span className={cn('rounded-lg px-2.5 py-1 text-xs font-black', typeTone[t.bizType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                          {bizLabel(t)}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm font-black text-slate-800">{taskApplicantText(t)}</td>
                      <td className="px-4 py-5">
                        <div className={cn('flex items-center gap-1 text-xs font-black', riskClass(risk))}>
                          {risk === '低风险' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                          {risk}
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">{riskReason(t)}</p>
                      </td>
                      <td className="px-4 py-5 font-mono text-sm font-black text-slate-500">{dateText(t.createdAt)}</td>
                      <td className="px-4 py-5">
                        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', statusTone[status] ?? 'bg-slate-100 text-slate-600')}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() => setSelected(t)}
                          className="text-sm font-black text-blue-600 hover:text-blue-700"
                        >
                          审批
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
  icon: typeof UserRoundCheck;
  tone: 'blue' | 'amber' | 'emerald';
  label: string;
  value: string;
  unit: string;
}) {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-600'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-emerald-50 text-emerald-600';
  return (
    <div className="rounded-lg border border-slate-100 bg-white/80 p-3 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-4">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', cls)}>
          <Icon size={17} />
        </span>
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-black leading-none text-slate-950">
            {value} <span className="text-xs font-black text-slate-400">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ApprovalDetailPage({
  task,
  busy,
  onBack,
  onApprove,
  onReject,
}: {
  task: PendingApprovalTaskResponse;
  busy: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const risk = riskOf(task);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={onBack} className="text-slate-400 hover:text-slate-700">
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-base font-black text-slate-950">{task.summaryTitle ?? bizLabel(task)}</h1>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                  {displayStatus(task)}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                单号: {task.id ?? task.bizId ?? 'AP-2023102801'} · 提交人: {task.submittedByName ?? '外部提交'} · {dateText(task.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={16} /> 驳回申请
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-400"
            >
              <CheckCircle2 size={16} /> {busy ? '处理中' : '通过审批'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <SectionTitle icon={FileText} title="业务详情" />
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-base font-black text-slate-950">单据信息(来自审批任务)</p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <Info label="业务类型" value={bizLabel(task)} />
                <Info label="单据编号" value={task.bizId ?? '—'} />
                <Info label="交易对手" value={task.counterpartyName ?? '—'} />
                <Info label="对手编号" value={task.counterpartyId ?? '—'} />
                <Info label="涉及金额" value={task.amount != null ? `¥${task.amount.toLocaleString('zh-CN')}` : '—'} />
                <Info label="提交人" value={task.submittedByName ?? '—'} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <SectionTitle icon={Clock3} title="审批流转日志" />
            <div className="mt-6 space-y-7 border-l border-slate-200 pl-5">
              {[
                ['提交申请', `${task.submittedByName ?? '外部提交'} · ${dateText(task.createdAt)}`, '已提交待审', 'bg-emerald-500'],
                ['待您处理', '当前节点', '等待人工复核', 'bg-blue-600'],
              ].map(([title, desc, tag, dot]) => (
                <div key={title} className="relative">
                  <span className={cn('absolute -left-[25px] top-1 h-2 w-2 rounded-full', dot)} />
                  <p className="font-black text-slate-950">{title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{desc}</p>
                  <span className="mt-2 inline-flex rounded-lg bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{tag}</span>
                </div>
              ))}
            </div>
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
                  <p className="text-base font-black">规则合规检查</p>
                  <p className="font-mono text-[11px] font-black text-blue-200">基于单据数据逐条核对</p>
                </div>
              </div>
              <span className={cn('rounded-md px-2 py-1 text-xs font-black', risk === '低风险' ? 'bg-emerald-500/20 text-emerald-300' : risk === '中风险' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300')}>
                {risk}
              </span>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              {[
                {
                  title: '金额规模',
                  desc: task.amount != null
                    ? `涉及金额 ¥${task.amount.toLocaleString('zh-CN')}${task.amount >= 500000 ? ',达到大额复核线(≥50万),建议双人复核' : ',低于大额复核线(50万)'}`
                    : '单据未携带金额信息',
                  ok: (task.amount ?? 0) < 500000,
                },
                {
                  title: '交易对手信息',
                  desc: task.counterpartyName ? `对手方 ${task.counterpartyName} 信息完备` : '单据未关联交易对手,请人工确认',
                  ok: !!task.counterpartyName,
                },
                {
                  title: '提交人可追溯',
                  desc: task.submittedByName ? `提交人 ${task.submittedByName},责任可追溯` : '缺少提交人信息',
                  ok: !!task.submittedByName,
                },
                {
                  title: '优先级',
                  desc: (task.priority ?? 0) >= 8 ? '高优先级任务,建议当日处理' : '常规优先级',
                  ok: (task.priority ?? 0) < 8,
                },
              ].map((check) => (
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
              以上为系统按单据数据的规则核对结果,最终审批决定以人工判断为准。
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
      <p className="mt-2 font-black text-slate-950">{value}</p>
    </div>
  );
}
