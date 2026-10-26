import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuotationPackage } from '@24bid/shared/quotation';
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
  Pencil,
  Save,
} from 'lucide-react';
import {
  type RfqResponse,
  axiosInstance,
  useRfqAbort,
  useRfqAnnounceResult,
  useRfqOpen,
  useRfqRemind,
  useRfqStartNewRound,
  useRfqAcceptEnrollment,
  useRfqDismissEnrollment,
  useRfqListEnrollments,
  useRfqListAnnouncements,
  useWorkflowRfqAwardSubmit,
  useRfqUpdate,
} from '@24bid/api-client';
import { ConfirmDialog, FeedbackNotice, StatusPill, cn } from '@24bid/ui';
import { QuoteComparisonTable } from './quote-comparison-table';
import { RfqQuotationPackage } from './rfq-quotation-package';
import { RfqClarificationsBuyer } from './rfq-clarifications';
import { RfqResultBuyer } from './rfq-result';
import { RfqSupplierPerformance } from './rfq-supplier-performance';
import { BidEvaluationPanel } from '../quotes/bid-evaluation-panel';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';

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
    ? `已收到 ${bidders} 家报价，达到参考报价家数；仍需人工核验技术响应及采购规则。`
    : `${method ?? '询比'}参考定标家数为 3 家有效报价(当前 ${bidders} 家)。依法必须招标/政府采购项目应予流标;民企等非依法必招项目可继续定标,系统将自动留痕。`;
};

// 定标资格(镜像后端 RfqMethod.requireAwardEligible):不足门槛时开放「流标」入口。
const awardEligible = (method: string | undefined, bidders: number): boolean => {
  const m = method ?? '询比';
  if (m === '商城') return true;
  if (m === '单一来源') return bidders >= 1;
  return bidders >= 3;
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
  const award = useWorkflowRfqAwardSubmit();
  const newRound = useRfqStartNewRound();
  const abort = useRfqAbort();
  const update = useRfqUpdate();
  const [draftEdit, setDraftEdit] = useState<{ title: string; deadline: string; quote: string; delivery: string; evaluation: string } | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const remind = useRfqRemind();
  const enrollments = useRfqListEnrollments(rfq.id ?? '', { query: { enabled: !!rfq.id } });
  const rfqAnnouncements = useRfqListAnnouncements(rfq.id ?? '', { query: { enabled: !!rfq.id } });
  const acceptEnrollment = useRfqAcceptEnrollment();
  const dismissEnrollment = useRfqDismissEnrollment();
  const announce = useRfqAnnounceResult();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundForm, setRoundForm] = useState<{ deadline: string; final: boolean; note: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'open-early' | 'no-bid' | 'abort' | null>(null);
  const [awardDraft, setAwardDraft] = useState<{ quoteId: string; reason: string } | null>(null);

  const quoting = rfq.status === '报价中';
  const terminal = TERMINAL[rfq.status ?? ''];
  const currentIndex = stageIndex(rfq);
  const isDraft = rfq.status === '草稿';
  const invited = rfq.invitedSupplierIds ?? [];
  const quotes = rfq.quotes ?? [];
  const quotation=useQuery({queryKey:['quotation-package',rfq.id],enabled:!!rfq.id&&rfq.method==='询比',
    queryFn:async()=>(await axiosInstance.get<{data:QuotationPackage}>(`/api/v1/buyer/rfqs/${rfq.id}/quotation-package`)).data.data});
  const receivedCount=quotation.data?.policy.fullQuoteRequired?quotation.data.validQuoteCount:quotes.length;
  const quotedSuppliers = new Set([...quotes.map((q) => q.supplierId),...(quotation.data?.submittedSupplierIds??[])]);
  useEffect(()=>{if(quotation.data?.deadlineAt&&quotation.data.deadlineAt!==rfq.deadlineAt)
    void queryClient.invalidateQueries({predicate:q=>typeof q.queryKey[0]==='string'&&(q.queryKey[0] as string).includes('/buyer/rfqs')});
  },[quotation.data?.deadlineAt,rfq.deadlineAt,queryClient]);
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
                <h2 className="break-words text-xl font-black text-slate-950">{rfq.title}</h2>
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

      {rfq.id && <WorkflowStatusPanel businessType="rfq_award" businessId={rfq.id} />}

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
                              ? `${receivedCount}/${invited.length || '不限'} 家已报`
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
          <button type="button" onClick={() => setDraftEdit({ title: rfq.title ?? '',
            deadline: rfq.deadlineAt ? new Date(new Date(rfq.deadlineAt).getTime() - new Date(rfq.deadlineAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
            quote: rfq.quoteRequirement ?? '', delivery: rfq.deliveryRequirement ?? '', evaluation: rfq.evaluationMethod ?? '最低价' })}
            className="inline-flex items-center gap-1 rounded border bg-white px-3 py-2 text-xs font-bold"><Pencil size={14} />编辑草稿</button>
          <button type="button" onClick={() => setCancelReason('')} className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">
            <Ban size={14} />取消草稿</button>
        </div>
      )}

      {isDraft && draftEdit && <form className="space-y-3 rounded-lg border bg-white p-5" onSubmit={(event) => {
        event.preventDefault(); if (!rfq.id || !draftEdit.deadline || !draftEdit.title.trim()) return;
        update.mutate({ rfqId: rfq.id, data: { title: draftEdit.title.trim(), invitedSupplierIds: invited,
          deadlineAt: draftEdit.deadline===rfq.deadlineAt?.slice(0,16)?rfq.deadlineAt:new Date(draftEdit.deadline).toISOString(), quoteRequirement: draftEdit.quote,
          deliveryRequirement: draftEdit.delivery, evaluationMethod: draftEdit.evaluation } }, {
          onSuccess: () => { setDraftEdit(null); refresh(); }, onError: reportError,
        });
      }}>
        <label className="block text-sm">项目名称<input required className={inputCls} value={draftEdit.title} onChange={(e) => setDraftEdit({ ...draftEdit, title: e.target.value })} /></label>
        <label className="block text-sm">报价截止时间<input required type="datetime-local" className={inputCls} value={draftEdit.deadline} onChange={(e) => setDraftEdit({ ...draftEdit, deadline: e.target.value })} /></label>
        <label className="block text-sm">报价要求<textarea className={inputCls} value={draftEdit.quote} onChange={(e) => setDraftEdit({ ...draftEdit, quote: e.target.value })} /></label>
        <label className="block text-sm">交付要求<textarea className={inputCls} value={draftEdit.delivery} onChange={(e) => setDraftEdit({ ...draftEdit, delivery: e.target.value })} /></label>
        <label className="block text-sm">评选方式<select className={inputCls} value={draftEdit.evaluation} onChange={(e) => setDraftEdit({ ...draftEdit, evaluation: e.target.value })}><option>最低价</option><option>综合评分</option></select></label>
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setDraftEdit(null)}>返回</button>
          <button type="submit" disabled={update.isPending} className="inline-flex items-center gap-1 rounded bg-blue-700 px-4 py-2 text-sm text-white"><Save size={14} />保存草稿</button></div>
      </form>}

      {isDraft && cancelReason !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <form role="dialog" aria-label="取消草稿" className="w-full max-w-md space-y-4 rounded-lg bg-white p-5" onSubmit={(event) => {
          event.preventDefault(); if (!rfq.id || !cancelReason.trim()) return;
          abort.mutate({ rfqId: rfq.id, data: { kind: '废标', reason: cancelReason.trim() } }, {
            onSuccess: () => { setCancelReason(null); refresh(); }, onError: reportError,
          });
        }}><h3 className="font-bold">取消草稿</h3>
          <label className="block text-sm">取消原因<textarea required maxLength={1000} className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></label>
          {error && <FeedbackNotice tone="error" message={error} />}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setCancelReason(null)} disabled={abort.isPending}>返回</button>
            <button type="submit" disabled={abort.isPending || !cancelReason.trim()} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-40">确认取消草稿</button></div>
        </form>
      </div>}

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
            {receivedCount} / {invited.length || '公开'}
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

      {rfq.id&&rfq.method==='询比'&&<RfqQuotationPackage rfqId={rfq.id} status={rfq.status} supplierNames={supplierNames} items={rfq.items} />}

      {/* 参考智能审批详情布局:主栏(参与进度/澄清/定标)+ 右栏(商机报名紧凑卡) */}
      <div className={(enrollments.data?.data ?? []).length > 0 ? 'grid items-start gap-4 xl:grid-cols-[1fr_22rem]' : undefined}>
      <div className="min-w-0 space-y-4">
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
                disabled={open.isPending || (rfq.method === '竞价' && !deadlinePassed)}
                onClick={() => {
                  if (!rfq.id) return;
                  if (deadlinePassed) {
                    open.mutate({ rfqId: rfq.id, data: { force: false } }, { onSuccess: refresh, onError: reportError });
                  } else {
                    setConfirmAction('open-early');
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                <LockOpen size={14} /> {deadlinePassed ? '开标' : rfq.method === '竞价' ? '截止后开标' : '提前截标开标'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('no-bid')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
              >
                <Ban size={14} /> 流标
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {invited.length === 0 && (
            <p className="py-3 text-xs font-bold text-slate-400">公开征集,不预先限定供应商;已收到 {receivedCount} 家报价。</p>
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

      {/* 采购清单:项目要采购什么(源自关联需求),供应商按此逐行报价——买卖双方同一份 */}
      {(rfq.items ?? []).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-slate-950">采购清单</h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
              共 {(rfq.items ?? []).length} 行 · 供应商按此逐行报价
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                <tr>
                  <th className="px-3 py-2">物资名称</th>
                  <th className="px-3 py-2">规格</th>
                  <th className="px-3 py-2 text-right">数量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(rfq.items ?? []).map((item) => (
                  <tr key={item.demandItemId} className="font-bold text-slate-700">
                    <td className="px-3 py-2 font-black text-slate-900">{item.materialName}</td>
                    <td className="px-3 py-2 text-slate-500">{item.specification || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {item.quantity} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rfq.id && <RfqClarificationsBuyer rfqId={rfq.id} canBulletin={quoting} />}

      {/* 公告记录:发布/补遗/再次报价/定标/终止时自动生成,同步门户公告中心公示 */}
      {(rfqAnnouncements.data?.data ?? []).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-slate-950">公告记录</h3>
            <span className="text-xs font-bold text-slate-400">由业务节点自动生成,已同步门户「公告中心」公示。</span>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {(rfqAnnouncements.data?.data ?? []).map((ann) => (
              <div key={ann.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-black',
                    ann.type === '采购公告' ? 'bg-blue-50 text-blue-700'
                      : ann.type === '变更公告' ? 'bg-amber-50 text-amber-700'
                        : ann.type === '定标公告' ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600',
                  )}>{ann.type}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-black text-slate-950">{ann.title}</p>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-slate-400">
                    {ann.publishedAt?.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{ann.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}


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
              {/* 流标=有效报价不足(仅门槛未达时开放);废标=评审发现重大偏差。两者为不同终止状态。 */}
              {rfq.status === '已开标' && !awardEligible(rfq.method ?? undefined, quotes.length) && (
                <button
                  type="button"
                  title="有效报价家数不足定标门槛,依规终止本项目"
                  onClick={() => setConfirmAction('no-bid')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-black text-white hover:bg-red-700"
                >
                  <Ban size={14} /> 流标
                </button>
              )}
              {rfq.status === '已开标' && (
                <button
                  type="button"
                  title="评审中发现重大偏差(如围标/资质造假/实质性不响应),终止本项目"
                  onClick={() => setConfirmAction('abort')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
                >
                  <Ban size={14} /> 废标
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-[11px] font-bold text-sky-700">
            {rfq.method ?? '询比'} · 定标门槛:{awardGateHint(rfq.method ?? undefined, quotes.length)}
            {rfq.status === '已开标' && !awardEligible(rfq.method ?? undefined, quotes.length) && (
              <span className="ml-1 font-black">如需终止可点右上角「流标」;继续定标则直接在下方选定报价。「废标」仅用于评审发现重大偏差。</span>
            )}
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
              awardingQuoteId={award.isPending ? (award.variables?.quoteId ?? null) : null}
              onAward={(quoteId) =>
                setAwardDraft({ quoteId, reason: '含税总价与交期综合最优' })
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
                  setAwardDraft({ quoteId, reason })
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
      </div>

      {/* 商机报名:门户报名登记 → 受理(转正式邀请)/ 忽略;紧凑卡置于右栏 */}
      {(enrollments.data?.data ?? []).length > 0 && (
        <aside className="rounded-lg border border-amber-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between rounded-t-md border-b border-amber-100 bg-amber-50/70 px-4 py-3">
            <p className="text-sm font-black text-slate-950">商机报名</p>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-black text-white">
              {(enrollments.data?.data ?? []).filter((en) => en.status === '待处理').length}
            </span>
          </div>
          <p className="px-4 pt-3 text-[11px] font-bold text-slate-400">
            来自门户商机大厅的报名登记;受理后自动发出询价邀请。
          </p>
          <div className="divide-y divide-slate-100 px-4 pb-2">
            {(enrollments.data?.data ?? []).map((en) => (
              <div key={en.id} className="py-3">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-black text-slate-950">
                  <span className="break-words">{en.companyName}</span>
                  {en.matchedSupplierId ? (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">平台认证</span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">未入驻</span>
                  )}
                  <span className={
                    en.status === '待处理'
                      ? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700'
                      : en.status === '已受邀'
                        ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700'
                        : 'rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500'
                  }>{en.status}</span>
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {en.contactName} · {en.contactPhone}
                  <br />报名于 {en.createdAt?.slice(0, 16).replace('T', ' ')}
                  {en.note ? ` · ${en.note}` : ''}
                </p>
                {en.status === '待处理' && (
                  <div className="mt-2 flex gap-2">
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
                      className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-emerald-600 px-2 text-[11px] font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
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
                      className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      忽略
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}
      </div>



      <ConfirmDialog
        open={confirmAction === 'open-early'}
        tone="primary"
        title="提前截标开标"
        message="报价截止时间尚未到达。提前截标将立即结束报价收集并开标,未提交报价的供应商将无法再报价。确认继续?"
        confirmLabel="确认开标"
        busy={open.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          rfq.id && open.mutate(
            { rfqId: rfq.id, data: { force: true } },
            { onSuccess: () => { setConfirmAction(null); refresh(); }, onError: (e) => { setConfirmAction(null); reportError(e); } },
          );
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'no-bid'}
        tone="danger"
        title="确认流标"
        message={`当前有效报价 ${quotes.length} 家,低于 3 家参考门槛。流标将终止本项目并释放关联需求,可重新立项;流标公告将同步门户公示。`}
        confirmLabel="确认流标"
        busy={abort.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          rfq.id && abort.mutate(
            { rfqId: rfq.id, data: { kind: '流标', reason: '有效报价不足,予以流标' } },
            { onSuccess: () => { setConfirmAction(null); refresh(); }, onError: (e) => { setConfirmAction(null); reportError(e); } },
          );
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'abort'}
        tone="danger"
        title="确认废标"
        message="废标适用于评审发现重大偏差的情形(如围标、资质造假、实质性不响应)。废标将终止本项目并释放关联需求;废标公告将同步门户公示。"
        confirmLabel="确认废标"
        busy={abort.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          rfq.id && abort.mutate(
            { rfqId: rfq.id, data: { kind: '废标', reason: '评审发现重大偏差,予以废标' } },
            { onSuccess: () => { setConfirmAction(null); refresh(); }, onError: (e) => { setConfirmAction(null); reportError(e); } },
          );
        }}
      />

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
      {awardDraft && rfq.id && (
        <WorkflowSubmitDialog
          businessType="rfq_award"
          title={`${rfq.title} · 定标审批`}
          busy={award.isPending}
          submissionError={award.error}
          onClose={() => setAwardDraft(null)}
          onSubmit={(formData) =>
            award.mutate(
              { rfqId: rfq.id!, ...awardDraft, formData },
              {
                onSuccess: () => {
                  setAwardDraft(null);
                  setFeedback('已提交定标审批，待候选审批人办理。');
                  refresh();
                },
                onError: reportError,
              },
            )
          }
        />
      )}
    </div>
  );
}
