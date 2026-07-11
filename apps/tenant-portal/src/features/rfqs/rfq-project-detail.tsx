import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  BellRing,
  CheckCircle2,
  Clock3,
  LockOpen,
  RotateCcw,
  Timer,
  Trophy,
} from 'lucide-react';
import {
  type RfqResponse,
  useRfqAbort,
  useRfqAnnounceResult,
  useRfqAwardAward,
  useRfqOpen,
  useRfqRemind,
  useRfqStartNewRound,
  useRfqAcceptEnrollment,
  useRfqDismissEnrollment,
  useRfqListEnrollments,
} from '@24bid/api-client';
import { FeedbackNotice, StatusPill, cn } from '@24bid/ui';
import { QuoteComparisonTable } from './quote-comparison-table';
import { RfqClarificationsBuyer } from './rfq-clarifications';
import { RfqResultBuyer } from './rfq-result';
import { RfqSupplierPerformance } from './rfq-supplier-performance';
import { BidEvaluationPanel } from '../quotes/bid-evaluation-panel';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

// 项目全流程节点:报价对比/定标是流程中的「定标决策」环节,而非独立模块。
const STAGES = ['建项需求', '选择供应商', '发布询价单', '接收报价', '定标决策'] as const;

function stageIndex(rfq: RfqResponse): number {
  if (rfq.status === '草稿') {
    return (rfq.invitedSupplierIds ?? []).length > 0 ? 2 : 1; // 建项已完成→选商/发布
  }
  if (rfq.status === '报价中') return 3;
  return 4; // 已开标 / 定标审批中 / 已定标均处于定标决策环节
}

const TERMINAL: Record<string, string> = { 已流标: '流标', 已废标: '废标' };

function useCountdown(deadlineAt?: string | null, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!deadlineAt) return '—';
  const ms = new Date(deadlineAt).getTime() - now;
  if (ms <= 0) return '已截止';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 各采购方式定标门槛提示。
const awardGateHint = (method?: string, bidders = 0): string => {
  if (method === '商城') return '商城采购按商品目录/货架规则执行，不强制供应商报价定标。';
  if (method === '单一来源') return bidders >= 1 ? '单一来源已收到报价，可定标。' : '单一来源须有 1 家有效报价。';
  return bidders >= 3
    ? `已收到 ${bidders} 家有效报价,满足法定家数。`
    : `${method ?? '询比'}定标须不少于 3 家有效报价(当前 ${bidders} 家),否则应予流标。`;
};

export function RfqProjectDetail({
  rfq,
  budget,
  supplierNames,
  onBack,
  onResumeDraft,
}: {
  rfq: RfqResponse;
  budget: number;
  supplierNames: Record<string, string>;
  onBack: () => void;
  onResumeDraft?: () => void;
}) {
  const queryClient = useQueryClient();
  const open = useRfqOpen();
  const award = useRfqAwardAward();
  const newRound = useRfqStartNewRound();
  const abort = useRfqAbort();
  const remind = useRfqRemind();
  const enrollments = useRfqListEnrollments(rfq.id ?? '', { query: { enabled: !!rfq.id } });
  const acceptEnrollment = useRfqAcceptEnrollment();
  const dismissEnrollment = useRfqDismissEnrollment();
  const announce = useRfqAnnounceResult();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundForm, setRoundForm] = useState<{ deadline: string; final: boolean; note: string } | null>(null);

  const quoting = rfq.status === '报价中';
  const terminal = TERMINAL[rfq.status ?? ''];
  const currentIndex = stageIndex(rfq);
  const isDraft = rfq.status === '草稿';
  const invited = rfq.invitedSupplierIds ?? [];
  const quotes = rfq.quotes ?? [];
  const quotedSuppliers = new Set(quotes.map((q) => q.supplierId));
  const countdown = useCountdown(rfq.deadlineAt, quoting);
  const deadlinePassed = rfq.deadlineAt ? new Date(rfq.deadlineAt).getTime() <= Date.now() : false;

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(rfqs|demands)/.test(q.queryKey[0] as string),
    });
  };
  const reportError = (e: unknown) =>
    setError(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试',
    );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-lg font-black text-slate-950">{rfq.title}</h2>
                {rfq.status && <StatusPill label={rfq.status} />}
                {(rfq.currentRound ?? 1) > 1 && (
                  <span className="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">
                    第{rfq.currentRound}轮{rfq.finalRound ? ' · 最终' : ''}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">
                项目流水号: {rfq.id} · 类型: {rfq.method ?? '询比'} · 预算 {currency(budget)} · 评选 {rfq.evaluationMethod ?? '最低价'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        {terminal && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-xs font-black text-red-700">
            本项目已{terminal}{rfq.closeReason ? `:${rfq.closeReason}` : ''},流程终止。
          </div>
        )}
        <div className="grid grid-cols-5 items-start gap-2">
          {STAGES.map((stage, index) => {
            const done = !terminal && index < currentIndex;
            const current = !terminal && index === currentIndex;
            return (
              <div key={stage} className="relative text-center">
                {index < STAGES.length - 1 && <div className="absolute left-1/2 top-5 h-1 w-full bg-slate-100" />}
                <span
                  className={cn(
                    'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white',
                    done ? 'border-emerald-100 bg-emerald-500 text-white' : current ? 'border-blue-100 bg-blue-600 text-white' : 'border-slate-200 text-slate-300',
                  )}
                >
                  {done ? <CheckCircle2 size={17} /> : current ? <Timer size={17} /> : index === 4 ? <Trophy size={16} /> : <i className="h-2 w-2 rounded-full bg-current" />}
                </span>
                <p className={cn('mt-2 text-xs font-black', done || current ? 'text-blue-700' : 'text-slate-500')}>{stage}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                  {terminal
                    ? index < 3 ? '已完成' : '已终止'
                    : done
                      ? '已完成'
                      : current
                        ? index === 1
                          ? '草稿 · 待选商'
                          : index === 2
                            ? isDraft ? '草稿 · 待发布' : '待发布'
                            : index === 3
                              ? `${quotes.length}/${invited.length || '不限'} 家已报`
                              : rfq.status === '定标审批中' ? '定标审批中' : rfq.status === '已定标' ? (rfq.resultAnnouncedAt ? '已定标·已公告' : '已定标·待公告') : '比价定标中'
                        : '待开始'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="text-xs font-black text-blue-800">
            本项目为草稿,尚未发布;完成选商与发布后询价函才会下发给供应商。
          </p>
          {onResumeDraft && (
            <button
              type="button"
              onClick={onResumeDraft}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
            >
              继续办理(选商 / 发布)
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Clock3 size={18} className="mx-auto text-blue-600" />
          <p className="mt-1 text-xs font-black text-slate-400">剩余时间</p>
          <p className="mt-1 font-mono text-2xl font-black text-slate-950">{quoting ? countdown : '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <CheckCircle2 size={18} className="mx-auto text-emerald-600" />
          <p className="mt-1 text-xs font-black text-slate-400">已报价 / 受邀</p>
          <p className="mt-1 font-mono text-2xl font-black text-slate-950">
            {quotes.length} / {invited.length || '公开'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Timer size={18} className="mx-auto text-violet-600" />
          <p className="mt-1 text-xs font-black text-slate-400">报价截止</p>
          <p className="mt-1 font-mono text-2xl font-black text-slate-950">{rfq.deadlineAt?.slice(0, 10) ?? '—'}</p>
        </div>
      </div>

      {rfq.method === '竞价' && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs font-bold text-amber-800">
          竞价规则:起拍价 {currency(rfq.auctionStartPrice)} · 最小降价步长 {currency(rfq.auctionMinDecrement ?? 0)}
          {' · '}当前最低报价 {rfq.auctionLowestAmount != null ? currency(rfq.auctionLowestAmount) : '暂无出价'}
          {' · '}临近截止的出价将自动顺延
        </div>
      )}
      {rfq.method === '单一来源' && rfq.singleSourceReason && (
        <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-3 text-xs font-bold text-violet-700">
          来源说明:{rfq.singleSourceReason}
        </div>
      )}

      {feedback && <FeedbackNotice tone="success" message={feedback} />}
      {error && <FeedbackNotice tone="error" message={error} />}

      {/* 公开商机报名:门户报名登记 → 受理(转正式邀请)/ 忽略。 */}
      {(enrollments.data?.data ?? []).length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-slate-950">商机报名({(enrollments.data?.data ?? []).filter((en) => en.status === '待处理').length} 条待处理)</h3>
            <span className="text-xs font-bold text-slate-500">来自门户商机大厅的报名登记;受理后自动向对应平台供应商发出询价邀请。</span>
          </div>
          <div className="mt-3 divide-y divide-amber-100">
            {(enrollments.data?.data ?? []).map((en) => (
              <div key={en.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-950">
                    {en.companyName}
                    {en.matchedSupplierId ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">平台认证供应商</span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-500">未入驻平台</span>
                    )}
                    <span className={
                      en.status === '待处理'
                        ? 'rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-black text-amber-700'
                        : en.status === '已受邀'
                          ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700'
                          : 'rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-500'
                    }>{en.status}</span>
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {en.contactName} · {en.contactPhone} · 报名于 {en.createdAt?.slice(0, 16).replace('T', ' ')}
                    {en.note ? ` · ${en.note}` : ''}
                  </p>
                </div>
                {en.status === '待处理' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={acceptEnrollment.isPending || !en.matchedSupplierId}
                      title={en.matchedSupplierId ? undefined : '报名企业未入驻平台,请先通过「供应商邀请」引导入驻'}
                      onClick={() =>
                        rfq.id && en.id &&
                        acceptEnrollment.mutate(
                          { rfqId: rfq.id, enrollmentId: en.id },
                          { onSuccess: () => { setFeedback(`已受理「${en.companyName}」的报名并发出询价邀请。`); refresh(); }, onError: reportError },
                        )
                      }
                      className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
                    >
                      受理并邀请
                    </button>
                    <button
                      type="button"
                      disabled={dismissEnrollment.isPending}
                      onClick={() =>
                        rfq.id && en.id &&
                        dismissEnrollment.mutate(
                          { rfqId: rfq.id, enrollmentId: en.id },
                          { onSuccess: () => { setFeedback('已忽略该报名。'); refresh(); }, onError: reportError },
                        )
                      }
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      忽略
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-black text-slate-950">供应商参与进度</h3>
          {quoting && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={remind.isPending}
                onClick={() =>
                  rfq.id &&
                  remind.mutate(
                    { rfqId: rfq.id },
                    {
                      onSuccess: (res: { data?: number }) => setFeedback(`已向 ${res.data ?? 0} 家未报价供应商发送催标提醒。`),
                      onError: reportError,
                    },
                  )
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <BellRing size={14} /> 一键催标
              </button>
              <button
                type="button"
                disabled={open.isPending}
                onClick={() =>
                  rfq.id &&
                  (deadlinePassed || window.confirm('报价截止时间尚未到达。提前截标开标将结束报价收集,确认继续?')) &&
                  open.mutate(
                    { rfqId: rfq.id, data: { force: !deadlinePassed } },
                    { onSuccess: refresh, onError: reportError },
                  )
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                <LockOpen size={14} /> {deadlinePassed ? '开标' : '提前截标开标'}
              </button>
              <button
                type="button"
                onClick={() => rfq.id && abort.mutate({ rfqId: rfq.id, data: { kind: '流标', reason: '有效报价不足,予以流标' } }, { onSuccess: refresh, onError: reportError })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
              >
                <Ban size={14} /> 流标
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {invited.length === 0 && (
            <p className="py-3 text-xs font-bold text-slate-400">公开征集,不预先限定供应商;已收到 {quotes.length} 家报价。</p>
          )}
          {invited.map((supplierId) => {
            const submitted = quotedSuppliers.has(supplierId);
            const invitation = (rfq.invitations ?? []).find((inv) => inv.supplierId === supplierId);
            const declined = invitation?.inviteStatus === '已拒绝';
            const viewed = invitation?.viewedAt;
            const stateLabel = declined ? '已拒绝参与' : submitted ? '已提交报价' : viewed ? '已查看询价单' : '未读';
            return (
              <div key={supplierId} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-600">
                    {(supplierNames[supplierId] ?? supplierId).slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-950">{supplierNames[supplierId] ?? supplierId}</p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {declined
                        ? invitation?.declineReason ?? '供应商拒绝参与'
                        : submitted
                          ? quoting ? '已提交报价(封存,开标后可见)' : '已提交报价'
                          : viewed
                            ? `${viewed.slice(5, 16).replace('T', ' ')} 已读`
                            : isDraft ? '待发布后通知' : '尚未查看询价单'}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-black',
                    declined
                      ? 'bg-red-50 text-red-700'
                      : submitted
                        ? 'bg-emerald-50 text-emerald-700'
                        : viewed
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {stateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!quoting && !terminal && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-black text-slate-950">定标决策 · 报价对比</h3>
            <div className="flex gap-2">
              {rfq.status === '已开标' && !rfq.finalRound && (
                <button
                  type="button"
                  onClick={() => setRoundForm({ deadline: '', final: false, note: '' })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 text-xs font-black text-violet-700 hover:bg-violet-50"
                >
                  <RotateCcw size={14} /> 再次报价
                </button>
              )}
              {rfq.status === '已开标' && (
                <button
                  type="button"
                  onClick={() => rfq.id && abort.mutate({ rfqId: rfq.id, data: { kind: '废标', reason: '评审发现重大偏差,予以废标' } }, { onSuccess: refresh, onError: reportError })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
                >
                  <Ban size={14} /> 废标
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-[11px] font-bold text-sky-700">
            {rfq.method ?? '询比'} · 定标门槛:{awardGateHint(rfq.method ?? undefined, quotes.length)}
          </div>
          {budget > 0 && quotes.length > 0 && (() => {
            const lowest = Math.min(...quotes.map((q) => q.amount ?? Number.POSITIVE_INFINITY));
            if (!Number.isFinite(lowest)) return null;
            const premium = ((lowest - budget) / budget) * 100;
            return (
              <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[11px] font-bold text-indigo-700">
                市场参考(关联需求预算,数据来源:需求/物料目录):{currency(budget)}
                {' · '}最低报价 {currency(lowest)}
                {' · '}溢价率 <span className={premium <= 0 ? 'text-emerald-600' : 'text-red-600'}>{premium.toFixed(2)}%{premium <= 0 ? '(优)' : ''}</span>
              </div>
            );
          })()}
          {rfq.id && <RfqSupplierPerformance rfqId={rfq.id} supplierNames={supplierNames} />}
          <div className="mt-3">
            <QuoteComparisonTable
              quotes={quotes}
              supplierNames={supplierNames}
              canAward={rfq.status === '已开标'}
              awardingQuoteId={award.isPending ? (award.variables?.data.quoteId ?? null) : null}
              onAward={(quoteId) =>
                rfq.id &&
                award.mutate(
                  { rfqId: rfq.id, data: { quoteId, reason: '含税总价与交期综合最优' } },
                  { onSuccess: refresh, onError: reportError },
                )
              }
            />
          </div>
          {rfq.status !== '已开标' && (
            <p className="mt-2 text-xs font-bold text-slate-400">当前状态「{rfq.status}」,定标入口仅在已开标时开放。</p>
          )}
          {rfq.id && rfq.status === '已开标' && quotes.length > 0 && (
            <div className="mt-4">
              <BidEvaluationPanel
                rfqId={rfq.id}
                supplierNames={supplierNames}
                canAward={rfq.status === '已开标'}
                awarding={award.isPending}
                onAward={(quoteId, reason) =>
                  rfq.id && award.mutate({ rfqId: rfq.id, data: { quoteId, reason } }, { onSuccess: refresh, onError: reportError })
                }
              />
            </div>
          )}
        </div>
      )}

      {rfq.status === '已定标' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          {rfq.resultAnnouncedAt ? (
            <p className="text-xs font-black text-emerald-800">
              结果公告已于 {rfq.resultAnnouncedAt.slice(0, 16).replace('T', ' ')} 发布,全体受邀方已收到公示通知。
            </p>
          ) : (
            <>
              <p className="text-xs font-black text-emerald-800">
                已定标:建议发布结果公告,向全体受邀方公示中标结果(未中标方将收到致谢通知)。
              </p>
              <button
                type="button"
                disabled={announce.isPending}
                onClick={() =>
                  rfq.id &&
                  announce.mutate(
                    { rfqId: rfq.id },
                    { onSuccess: () => { setFeedback('结果公告已发布,全体受邀方已收到公示通知。'); refresh(); }, onError: reportError },
                  )
                }
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                发布结果公告
              </button>
            </>
          )}
        </div>
      )}
      {rfq.status === '已定标' && rfq.id && <RfqResultBuyer rfqId={rfq.id} supplierNames={supplierNames} />}

      {rfq.id && <RfqClarificationsBuyer rfqId={rfq.id} canBulletin={quoting} />}

      {roundForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" onClick={() => setRoundForm(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-black text-slate-950">发起新一轮报价</p>
            <p className="mt-0.5 text-xs font-bold text-slate-400">将重新封存,受邀供应商在新一轮重新报价;评标只看最新一轮。</p>
            <div className="mt-4">
              <label className="text-xs font-black text-slate-500">新报价截止日期</label>
              <input
                type="date"
                className={inputCls}
                value={roundForm.deadline}
                onChange={(e) => setRoundForm({ ...roundForm, deadline: e.target.value })}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={roundForm.final}
                onChange={(e) => setRoundForm({ ...roundForm, final: e.target.checked })}
              />
              最终轮(BAFO · 最后一次报价机会)
            </label>
            <div className="mt-3">
              <label className="text-xs font-black text-slate-500">轮次说明（可选）</label>
              <textarea
                className={cn(inputCls, 'min-h-[56px] resize-y')}
                placeholder="本轮谈判要点、让价要求等,记入审计留痕。"
                value={roundForm.note}
                onChange={(e) => setRoundForm({ ...roundForm, note: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoundForm(null)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() =>
                  rfq.id &&
                  newRound.mutate(
                    {
                      rfqId: rfq.id,
                      data: {
                        deadlineAt: `${roundForm.deadline}T18:00:00+08:00`,
                        finalRound: roundForm.final,
                        note: roundForm.note || undefined,
                      },
                    },
                    { onSuccess: () => { setRoundForm(null); refresh(); }, onError: reportError },
                  )
                }
                disabled={newRound.isPending || !roundForm.deadline}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <RotateCcw size={14} /> {newRound.isPending ? '发起中…' : '确认发起'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
