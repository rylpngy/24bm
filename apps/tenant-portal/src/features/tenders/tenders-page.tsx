import { useMemo, useState } from 'react';
import { TenderDocumentReviewPanel } from './tender-document-review-panel';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, CheckCircle2, ClipboardCheck, FileBadge, Gavel, Info, Megaphone, Plus, Send, Timer, Trophy, Users } from 'lucide-react';
import {
  useBuyerEsignList,
  useBuyerEsignSign,
  useBuyerSupplierList,
  useBuyerTenderAward,
  useBuyerTenderCreate,
  useBuyerTenderDistribute,
  useBuyerTenderExecute,
  useBuyerTenderFail,
  useBuyerTenderFormCommittee,
  useBuyerTenderRebid,
  useBuyerTenderReviewPrequalification,
  useBuyerTenderSetPrequalificationRequired,
  useBuyerTenderList,
  useBuyerTenderOpen,
  useBuyerTenderPublish,
  useBuyerTenderSendInquiry,
  useBuyerTenderSubmitScores,
  useBuyerTenderUpdate,
  tenderDocumentReviews,
  useRfqListAnnouncements,
  type SaveTenderRequest,
  type TenderResponse,
} from '@24bid/api-client';
import {
  EsignRecordList,
  FeedbackNotice,
  FilterTabs,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ActionButton,
  ResponsiveTableFrame,
  RichTextEditor,
  RichTextView,
  SearchInput,
  SignaturePad,
  StatusPill,
  cn,
} from '@24bid/ui';
import { useAuthStore } from '../../lib/auth-store';
import { OwnerAttachments } from '../attachments/owner-attachments';

const PAGE_SIZE = 8;

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const shortTime = (v?: string | null) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—');

const typeTone: Record<string, string> = {
  公开招标: 'bg-blue-50 text-blue-700',
  邀请招标: 'bg-violet-50 text-violet-700',
};

const sealTone: Record<string, string> = {
  已密封: 'bg-emerald-50 text-emerald-700',
  已开启: 'bg-blue-50 text-blue-700',
  已撤回: 'bg-slate-100 text-slate-500',
};

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

interface DraftForm {
  title: string;
  tenderType: string;
  budget: string;
  evaluationMethod: string;
  bidBondAmount: string;
  acquisitionDeadline: string;
  submissionDeadline: string;
  openingAt: string;
  documentHtml: string;
}

const emptyForm = (): DraftForm => ({
  title: '',
  tenderType: '公开招标',
  budget: '',
  evaluationMethod: '综合评分法',
  bidBondAmount: '',
  acquisitionDeadline: '',
  submissionDeadline: '',
  openingAt: '',
  documentHtml: '',
});

const toLocal = (v?: string | null) => (v ? v.slice(0, 16) : '');
const toIso = (v: string) => (v ? new Date(v).toISOString() : undefined);

// C-4 评标委员会与评分表:开标后组建(≥3 单数)→ 逐评委评分(技术/商务 0-100)→
function eligibleTenderBids(tender: TenderResponse) {
  // Additive DTO field; generated clients are refreshed by the integration task.
  return (tender.bids ?? []).filter((bid) =>
    (bid as typeof bid & { evaluationEligible?: boolean | null }).evaluationEligible === true);
}

// 汇总排名(价格分自动折算),全员交卷后标记推荐中标人。
function EvaluationSection({
  tender: t,
  onFeedback,
  onError,
  refresh,
}: {
  tender: TenderResponse;
  onFeedback: (m: string) => void;
  onError: (m: string | null) => void;
  refresh: () => void;
}) {
  const formCommittee = useBuyerTenderFormCommittee();
  const { can } = useBuyerPermissions();
  const canManage = can('buyer:tender:manage');
  const submitScores = useBuyerTenderSubmitScores();
  const sendInquiry = useBuyerTenderSendInquiry();
  const [inqBidId, setInqBidId] = useState<string | null>(null);
  const [inqKind, setInqKind] = useState('澄清问询');
  const [inqQuestion, setInqQuestion] = useState('');
  const [members, setMembers] = useState<{ name: string; role: string }[]>([
    { name: '', role: '组长' }, { name: '', role: '成员' }, { name: '', role: '成员' },
  ]);
  const [activeEvaluator, setActiveEvaluator] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Record<string, { technical: string; commercial: string; comment: string }>>({});

  const evaluators = t.evaluators ?? [];
  const scores = t.scores ?? [];
  const summary = t.evaluationSummary ?? [];
  const validBids = eligibleTenderBids(t);
  const reportApiError = (e: unknown) =>
    onError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试');

  const currentEvaluator = evaluators.find((e) => e.id === activeEvaluator) ?? evaluators[0];
  const sheetFor = (bidId: string) => {
    if (sheet[bidId]) return sheet[bidId];
    const existing = scores.find((s) => s.evaluatorId === currentEvaluator?.id && s.bidId === bidId);
    return {
      technical: existing?.technicalScore != null ? String(existing.technicalScore) : '',
      commercial: existing?.commercialScore != null ? String(existing.commercialScore) : '',
      comment: existing?.comment ?? '',
    };
  };
  const sheetComplete = validBids.every((b) => {
    const v = sheetFor(b.id ?? '');
    return v.technical !== '' && v.commercial !== '';
  });

  const doFormCommittee = () => {
    if (!t.id) return;
    onError(null);
    formCommittee.mutate(
      { tenderId: t.id, data: { members: members.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), role: m.role })) } },
      {
        onSuccess: () => { onFeedback('评标委员会已组建,项目进入评标。'); refresh(); },
        onError: reportApiError,
      },
    );
  };

  const doSubmitScores = () => {
    if (!t.id || !currentEvaluator?.id || !sheetComplete || validBids.length === 0) return;
    onError(null);
    submitScores.mutate(
      {
        tenderId: t.id,
        data: {
          evaluatorId: currentEvaluator.id,
          lines: validBids.map((b) => {
            const v = sheetFor(b.id ?? '');
            return {
              bidId: b.id ?? '',
              technicalScore: Number(v.technical),
              commercialScore: Number(v.commercial),
              comment: v.comment || undefined,
            };
          }),
        },
      },
      {
        onSuccess: () => {
          onFeedback(`评委「${currentEvaluator.evaluatorName}」评分已提交。`);
          setSheet({});
          refresh();
        },
        onError: reportApiError,
      },
    );
  };

  const scoreInputCls =
    'w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-black text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <Users size={18} className="text-blue-600" /> 评标委员会与评分
        </h3>
        {evaluators.length > 0 && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
            委员会 {evaluators.length} 人 · 已交卷 {evaluators.filter((e) => (e.scoredCount ?? 0) >= validBids.length && validBids.length > 0).length} 人
          </span>
        )}
      </div>

      {evaluators.length === 0 && !canManage ? <p className="mt-3 text-sm text-slate-500">尚未组建评标委员会。</p> : evaluators.length === 0 ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-xs font-black text-blue-900">组建评标委员会(3 人及以上且为单数)</p>
          <div className="mt-2 space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
                  placeholder={`评委 ${i + 1} 姓名`} aria-label={`评委${i + 1}姓名`} value={m.name}
                  onChange={(e) => setMembers((cur) => cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <select
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-600"
                  value={m.role}
                  onChange={(e) => setMembers((cur) => cur.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                  <option value="组长">组长</option>
                  <option value="成员">成员</option>
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => setMembers((cur) => [...cur, { name: '', role: '成员' }, { name: '', role: '成员' }])}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
              + 增加 2 名评委
            </button>
            <PrimaryActionButton size="sm" onClick={doFormCommittee} busy={formCommittee.isPending} pendingLabel="组建中"
              disabled={members.filter((m) => m.name.trim()).length < 3}>
              组建委员会并进入评标
            </PrimaryActionButton>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evaluators.map((e) => (
              <button key={e.id} type="button" onClick={() => { setActiveEvaluator(e.id ?? null); setSheet({}); }}
                className={cn('rounded-lg border px-3 py-1.5 text-xs font-black transition',
                  (currentEvaluator?.id === e.id)
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                {e.evaluatorName}{e.evaluatorRole === '组长' ? '(组长)' : ''}
                <span className={cn('ml-1.5 rounded px-1 text-[10px]',
                  (e.scoredCount ?? 0) >= validBids.length && validBids.length > 0
                    ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                  {(e.scoredCount ?? 0) >= validBids.length && validBids.length > 0 ? '已交卷' : `${e.scoredCount ?? 0}/${validBids.length}`}
                </span>
              </button>
            ))}
          </div>

          {canManage && t.status === '评标中' && currentEvaluator && (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                  <tr>
                    <th className="px-3 py-2">投标人</th>
                    <th className="px-3 py-2 text-right">投标报价</th>
                    <th className="px-3 py-2 text-right">技术分(0-100)</th>
                    <th className="px-3 py-2 text-right">商务分(0-100)</th>
                    <th className="px-3 py-2">评审意见</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validBids.map((b) => {
                    const v = sheetFor(b.id ?? '');
                    const set = (patch: Partial<typeof v>) =>
                      setSheet((cur) => ({ ...cur, [b.id ?? '']: { ...v, ...patch } }));
                    return (
                      <tr key={b.id} className="font-bold text-slate-700">
                        <td className="px-3 py-2 font-black text-slate-900">{b.supplierName ?? b.supplierId}</td>
                        <td className="px-3 py-2 text-right font-mono">{currency(b.bidAmount)}</td>
                        <td className="px-3 py-2 text-right">
                          <input className={scoreInputCls} type="number" min="0" max="100" value={v.technical}
                            aria-label={`技术分-${b.supplierName ?? b.id}`}
                            onChange={(e) => set({ technical: e.target.value })} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input className={scoreInputCls} type="number" min="0" max="100" value={v.commercial}
                            aria-label={`商务分-${b.supplierName ?? b.id}`}
                            onChange={(e) => set({ commercial: e.target.value })} />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
                            placeholder="选填" value={v.comment}
                            onChange={(e) => set({ comment: e.target.value })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <p className="text-[11px] font-bold text-slate-400">
                  价格分由系统按最低有效报价自动折算;{t.evaluationMethod === '最低评标价法' ? '本项目按最低评标价法以报价升序排名。' : '综合得分 = 技术×50% + 商务×20% + 价格×30%。'}
                </p>
                <PrimaryActionButton size="sm" onClick={doSubmitScores} busy={submitScores.isPending}
                  pendingLabel="提交中" disabled={!sheetComplete || validBids.length === 0}>
                  <ClipboardCheck size={13} /> 提交「{currentEvaluator.evaluatorName}」评分
                </PrimaryActionButton>
              </div>
            </div>
          )}


          {/* C-9 评标问询与二次报价:发起 + 留痕 */}
          {canManage && t.status === '评标中' && validBids.length > 0 && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
              <p className="text-xs font-black text-blue-900">评标问询 / 二次报价(以评标委员会名义发出,定向投标人)</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="text-[11px] font-black text-slate-500">投标人</span>
                  <select className="mt-1 block h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700"
                    aria-label="问询投标人" value={inqBidId ?? validBids[0]?.id ?? ''}
                    onChange={(e) => setInqBidId(e.target.value)}>
                    {validBids.map((b) => <option key={b.id} value={b.id}>{b.supplierName ?? b.supplierId}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black text-slate-500">类别</span>
                  <select className="mt-1 block h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700"
                    aria-label="问询类别" value={inqKind} onChange={(e) => setInqKind(e.target.value)}>
                    <option value="澄清问询">澄清问询</option>
                    <option value="二次报价">二次报价</option>
                  </select>
                </label>
                <input className="h-9 min-w-56 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
                  placeholder={inqKind === '二次报价' ? '如:报价高于预算,请给出修订报价' : '如:请澄清质保期与到货周期'}
                  aria-label="问询内容" value={inqQuestion} onChange={(e) => setInqQuestion(e.target.value)} />
                <PrimaryActionButton size="sm" busy={sendInquiry.isPending} pendingLabel="发出中"
                  disabled={!inqQuestion.trim()}
                  onClick={() => t.id && sendInquiry.mutate(
                    { tenderId: t.id, data: { bidId: inqBidId ?? validBids[0]?.id ?? '', kind: inqKind, question: inqQuestion.trim() } },
                    {
                      onSuccess: () => { onFeedback(`已向投标人发出${inqKind},待其答复。`); setInqQuestion(''); refresh(); },
                      onError: reportApiError,
                    })}>
                  发出问询
                </PrimaryActionButton>
              </div>
            </div>
          )}
          {(t.inquiries ?? []).length > 0 && (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                  <tr>
                    <th className="px-3 py-2">类别</th>
                    <th className="px-3 py-2">投标人</th>
                    <th className="px-3 py-2">问询内容</th>
                    <th className="px-3 py-2">答复</th>
                    <th className="px-3 py-2 text-right">修订报价</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(t.inquiries ?? []).map((q) => (
                    <tr key={q.id} className="font-bold text-slate-700">
                      <td className="px-3 py-2">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                          q.kind === '二次报价' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')}>{q.kind}</span>
                      </td>
                      <td className="px-3 py-2 font-black text-slate-900">{q.supplierName ?? '—'}</td>
                      <td className="px-3 py-2">{q.question}</td>
                      <td className="px-3 py-2">{q.answer ?? <span className="text-slate-400">待答复</span>}</td>
                      <td className="px-3 py-2 text-right font-mono">{q.revisedAmount != null ? currency(q.revisedAmount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {summary.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black text-slate-500">评标汇总排名</p>
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">名次</th>
                      <th className="px-3 py-2">投标人</th>
                      <th className="px-3 py-2 text-right">报价</th>
                      <th className="px-3 py-2 text-right">技术均分</th>
                      <th className="px-3 py-2 text-right">商务均分</th>
                      <th className="px-3 py-2 text-right">价格分</th>
                      <th className="px-3 py-2 text-right">综合得分</th>
                      <th className="px-3 py-2 text-center">推荐</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.map((r) => (
                      <tr key={r.bidId} className={cn('font-bold text-slate-700', r.recommended && 'bg-emerald-50/50')}>
                        <td className="px-3 py-2 text-center font-mono font-black text-slate-400">{r.rank}</td>
                        <td className="px-3 py-2 font-black text-slate-900">{r.supplierName}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {currency(r.effectiveAmount ?? r.bidAmount)}
                          {r.effectiveAmount != null && r.bidAmount != null && r.effectiveAmount !== r.bidAmount && (
                            <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-black text-amber-700" title={`原报价 ${currency(r.bidAmount)}`}>二次</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{r.avgTechnicalScore ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.avgCommercialScore ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.priceScore ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-black text-slate-900">{r.compositeScore ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {r.recommended && (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700">推荐中标</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!summary.some((r) => r.recommended) && (
                <p className="mt-1.5 text-[11px] font-bold text-slate-400">全体评委对全部有效投标交卷后,系统标记推荐中标人。</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// C-5 定标 + 中标通知书:评标全员交卷产生推荐后,定标(默认推荐人)并签章中标通知书;
// 签章指纹绑定中标投标密封凭证与通知书正文,开标链路可核验。
function AwardSection({
  tender: t,
  onFeedback,
  onError,
  refresh,
}: {
  tender: TenderResponse;
  onFeedback: (m: string) => void;
  onError: (m: string | null) => void;
  refresh: () => void;
}) {
  const displayName = useAuthStore((s) => s.session?.displayName ?? '');
  const { can } = useBuyerPermissions();
  const canManage = can('buyer:tender:manage');
  const award = useBuyerTenderAward();
  const execute = useBuyerTenderExecute();
  const esign = useBuyerEsignSign();
  const [receiptDate, setReceiptDate] = useState('');
  const records = useBuyerEsignList(
    { targetType: 'tender-award', targetId: t.id ?? '' },
    { query: { enabled: !!t.awardedBidId && !!t.id } },
  );
  const summary = t.evaluationSummary ?? [];
  const recommended = summary.find((r) => r.recommended);
  const [bidId, setBidId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const reportApiError = (e: unknown) =>
    onError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试');

  // 已定标:结果卡 + 通知书 + 签章留痕
  if (t.awardedBidId) {
    const winner = (t.bids ?? []).find((b) => b.id === t.awardedBidId);
    return (
      <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm shadow-slate-200/50">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <Award size={18} className="text-blue-600" /> 定标结果与中标通知书
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MiniFact label="中标人" value={winner?.supplierName ?? '—'} />
          <MiniFact label="中标价" value={currency(summary.find((r) => r.bidId === t.awardedBidId)?.effectiveAmount ?? winner?.bidAmount)} />
          <MiniFact label="定标时间" value={shortTime(t.awardedAt)} />
        </div>
        {t.awardNoticeHtml && (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-black text-slate-500">中标通知书</p>
            <RichTextView html={t.awardNoticeHtml} className="mt-2" />
          </div>
        )}
        <div className="mt-3">
          <p className="text-xs font-black text-slate-500">招标人签章留痕</p>
          <div className="mt-2">
            {records.isError ? <FeedbackNotice tone="error" message="签署记录加载失败，请刷新重试。" /> : <EsignRecordList records={records.data?.data ?? []} />}
          </div>
        </div>

        {/* C-7 中标转执行:一键生成采购订单接入既有履约/财务/合同链 */}
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
          {t.executionOrderId ? (
            <p className="text-xs font-bold text-slate-600">
              <span className="font-black text-blue-800">执行订单已生成:</span>
              <span className="ml-1 font-mono">{t.executionOrderId}</span>
              <span className="ml-2 text-slate-400">供应商确认后在「采购订单」沿 发货 → 验收 → 发票 → 付款 → 合同 链继续履约。</span>
            </p>
          ) : !canManage || !can('buyer:order:manage') ? <p className="text-xs text-slate-500">尚未生成执行采购订单。</p> : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="text-xs font-black text-slate-500">预计到货日期</span>
                <input type="date" aria-label="预计到货日期" value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="mt-1 block h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300" />
              </label>
              <PrimaryActionButton size="sm" disabled={!receiptDate}
                busy={execute.isPending} pendingLabel="生成订单中"
                onClick={() => t.id && execute.mutate(
                  { tenderId: t.id, data: { expectedReceiptDate: receiptDate } },
                  {
                    onSuccess: (r) => { onFeedback(`中标转执行:采购订单 ${r.data?.executionOrderId ?? ''} 已生成并通知中标人确认。`); refresh(); },
                    onError: reportApiError,
                  })}>
                生成执行采购订单
              </PrimaryActionButton>
              <p className="text-[11px] font-bold text-slate-400">按中标价生成单行订单,进入既有履约与财务链。</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (!recommended || !canManage) return null;
  const selectedBidId = bidId ?? recommended.bidId ?? null;
  const selected = summary.find((r) => r.bidId === selectedBidId);
  const noticeTemplate = () =>
    `<p><strong>${selected?.supplierName ?? ''}:</strong></p>` +
    `<p>贵方参加本项目「${t.title ?? ''}」(招标编号 ${t.tenderNo ?? ''})的投标,经评标委员会评审,` +
    `贵方为中标人,中标价 ${currency(selected?.effectiveAmount ?? selected?.bidAmount)}。` +
    `请在收到本通知书后按招标文件约定与我方签订合同。</p>`;

  const doAward = () => {
    if (!t.id || !selectedBidId) return;
    onError(null);
    const noticeHtml = notice || noticeTemplate();
    award.mutate(
      { tenderId: t.id, data: { bidId: selectedBidId, awardNoticeHtml: noticeHtml } },
      {
        onSuccess: () => {
          onFeedback('已定标,中标通知书已保存。');
          if (signature && t.id) {
            esign.mutate(
              { data: { targetType: 'tender-award', targetId: t.id, signatureImage: signature, signerName: displayName } },
              {
                onSuccess: () => onFeedback('已定标,中标通知书站内签署记录已保存。'),
                onError: () => onError('定标已完成,但通知书签署记录保存失败,请核查签署记录。'),
                onSettled: refresh,
              },
            );
          }
          refresh();
        },
        onError: reportApiError,
      },
    );
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
        <Award size={18} className="text-blue-600" /> 定标与中标通知书
      </h3>
      <p className="mt-1 text-[11px] font-bold text-slate-400">
        默认按评标推荐定标;签发须招标人手写签章,签章指纹绑定中标投标密封凭证与通知书正文。
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-black text-slate-500">中标人(默认评标第一名)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {summary.map((r) => (
              <button key={r.bidId} type="button" onClick={() => setBidId(r.bidId ?? null)}
                className={cn('rounded-lg border px-3 py-1.5 text-xs font-black transition',
                  selectedBidId === r.bidId
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                {r.rank}. {r.supplierName} · {currency(r.effectiveAmount ?? r.bidAmount)}{r.recommended ? '(推荐)' : ''}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-slate-500">中标通知书正文(留空按模板签发)</p>
          <div className="mt-1.5">
            <RichTextEditor value={notice} onChange={setNotice} minHeight={140} placeholder={`将按模板签发:经评标委员会评审,确定 ${selected?.supplierName ?? ''} 为中标人……`} />
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-slate-500">
            <span className="mr-1 text-red-500">*</span>招标人电子签章(手写签名)
          </p>
          <SignaturePad className="mt-1.5" onChange={setSignature} />
        </div>
        <PrimaryActionButton onClick={doAward} busy={award.isPending || esign.isPending}
          pendingLabel="定标签章中" disabled={!selectedBidId || !signature}>
          <Award size={14} /> 定标并签章中标通知书
        </PrimaryActionButton>
      </div>
    </section>
  );
}


// ── 招标组织五阶段步进器(与询比项目详情/供应商端参与视图同口径) ──────
// 编制(文件)→ 发售(发放/领取)→ 开标(解封唱标)→ 评标(委员会)→ 定标(签章/转执行);流标即时终止。
const BUYER_TENDER_STAGES = ['编制', '发售', '开标', '评标', '定标'] as const;

function buyerTenderStageIndex(t: TenderResponse): number {
  if (t.status === '已定标') return 4;
  if (t.status === '评标中') return 3;
  if (t.status === '已开标' || t.status === '已流标') return 2;
  if (t.status === '发售中') return 1;
  return 0;
}

function BuyerTenderStepper({ tender: t }: { tender: TenderResponse }) {
  const currentIndex = buyerTenderStageIndex(t);
  const failed = t.status === '已流标';
  const acquisitions = t.acquisitions ?? [];
  const sealedCount = (t.bids ?? []).filter((b) => b.sealedStatus === '已密封').length;
  const openedCount = (t.bids ?? []).filter((b) => b.sealedStatus === '已开启').length;
  const validCount = eligibleTenderBids(t).length;
  const evaluators = t.evaluators ?? [];
  const doneEvaluators = evaluators.filter((e) => (e.scoredCount ?? 0) >= validCount && validCount > 0).length;
  const winner = (t.bids ?? []).find((b) => b.id === t.awardedBidId);
  const captions: string[] = [
    '文件与时间节点',
    `发放 ${acquisitions.length} · 领取 ${acquisitions.filter((a) => a.acquiredAt).length} · 密封 ${sealedCount}`,
    t.openedAt ? `已开启投标 ${openedCount} 份` : `开标 ${shortTime(t.openingAt)}`,
    evaluators.length > 0 ? `评委交卷 ${doneEvaluators}/${evaluators.length}` : '待组建委员会',
    t.status === '已定标'
      ? `${winner?.supplierName ?? '已定标'}${t.executionOrderId ? ' · 已转执行' : ''}`
      : '待定标',
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      {failed && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-xs font-black text-red-700">
          本项目已流标{t.failureReason ? `:${t.failureReason}` : ''},可在下方留痕卡一键重新招标。
        </div>
      )}
      <div className="grid grid-cols-5 items-start gap-2">
        {BUYER_TENDER_STAGES.map((stage, index) => {
          const done = !failed && index < currentIndex;
          const current = !failed && index === currentIndex;
          const deadHere = failed && index === 2;
          return (
            <div key={stage} className="relative text-center">
              {index < BUYER_TENDER_STAGES.length - 1 && <div className="absolute left-1/2 top-5 h-1 w-full bg-slate-100" />}
              <span className={cn(
                'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white',
                deadHere ? 'border-red-100 bg-red-500 text-white'
                  : done ? 'border-emerald-100 bg-emerald-500 text-white'
                    : current ? 'border-blue-100 bg-blue-600 text-white' : 'border-slate-200 text-slate-300',
              )}>
                {done ? <CheckCircle2 size={17} /> : current ? <Timer size={17} /> : index === 4 ? <Trophy size={16} /> : <i className="h-2 w-2 rounded-full bg-current" />}
              </span>
              <p className={cn('mt-2 text-xs font-black', done || current ? 'text-blue-700' : deadHere ? 'text-red-600' : 'text-slate-500')}>{stage}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                {deadHere ? '已流标' : failed && index > 2 ? '流程终止' : done || current ? captions[index] : '待开始'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// C-8 公告记录:发售(公开招标)/中标公示/流标公告由业务节点自动生成,与询比共用门户公告中心。
function TenderAnnouncements({ tenderId }: { tenderId: string }) {
  const anns = useRfqListAnnouncements(tenderId, { query: { enabled: !!tenderId } });
  const list = anns.data?.data ?? [];
  if (anns.isError) return <FeedbackNotice tone="error" message="公告记录加载失败，请刷新重试。" />;
  if (list.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-black text-slate-950">公告记录</h3>
        <span className="text-xs font-bold text-slate-400">由业务节点自动生成,已同步门户「公告中心」公示。</span>
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {list.map((ann) => (
          <div key={ann.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                ann.type === '采购公告' ? 'bg-blue-50 text-blue-700'
                  : ann.type === '定标公告' ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600')}>{ann.type}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-black text-slate-950">{ann.title}</p>
              <span className="shrink-0 font-mono text-[11px] font-bold text-slate-400">
                {ann.publishedAt?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{ann.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 招标管理(Track C C-1):文件编制(富文本)→ 发布发售 → 邀请发放 / 领取记录。
export function TendersPage() {
  const { can } = useBuyerPermissions();
  const canManage = can('buyer:tender:manage');
  const queryClient = useQueryClient();
  const tenders = useBuyerTenderList();
  const suppliers = useBuyerSupplierList({ status: '已准入' }, { query: { enabled: canManage && can('buyer:supplier:read') } });
  const create = useBuyerTenderCreate();
  const update = useBuyerTenderUpdate();
  const publish = useBuyerTenderPublish();
  const distribute = useBuyerTenderDistribute();
  const openTender = useBuyerTenderOpen();
  const failTender = useBuyerTenderFail();
  const rebidTender = useBuyerTenderRebid();
  const setPrequalRequired = useBuyerTenderSetPrequalificationRequired();
  const reviewPrequal = useBuyerTenderReviewPrequalification();
  const [prequalComments, setPrequalComments] = useState<Record<string, string>>({});
  const [failReason, setFailReason] = useState('');
  const [failing, setFailing] = useState(false);

  const [view, setView] = useState<'list' | 'edit' | 'detail'>(() => new URLSearchParams(window.location.search).get('recordId') ? 'detail' : 'list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('recordId'));
  const [form, setForm] = useState<DraftForm>(emptyForm());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [distributeIds, setDistributeIds] = useState<string[]>([]);

  const all = tenders.isError ? [] : tenders.data?.data ?? [];
  const selected = selectedId ? all.find((t) => t.id === selectedId) : undefined;
  const documentReview = useQuery({ queryKey: ['tender-document-review', selectedId], enabled: !!selectedId,
    queryFn: () => tenderDocumentReviews(selectedId!) });
  const showDetail = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('recordId', id);
    window.history.replaceState(null, '', url);
    setSelectedId(id);
    setView('detail');
  };
  const backToList = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('recordId');
    window.history.replaceState(null, '', url);
    setSelectedId(null);
    setView('list');
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      // 公告记录(/buyer/rfqs/{tenderId}/announcements)随业务节点新增,须一并失效。
      predicate: (q) => typeof q.queryKey[0] === 'string'
        && (/\/buyer\/(tenders|rfqs\/[^/]+\/announcements)/.test(q.queryKey[0] as string) || q.queryKey[0] === 'tender-document-review'),
    });

  const reportError = (e: unknown) =>
    setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试');

  const payload = (): SaveTenderRequest => ({
    title: form.title.trim(),
    tenderType: form.tenderType,
    budget: form.budget ? Number(form.budget) : undefined,
    evaluationMethod: form.evaluationMethod || undefined,
    bidBondAmount: form.bidBondAmount ? Number(form.bidBondAmount) : undefined,
    acquisitionDeadline: toIso(form.acquisitionDeadline),
    submissionDeadline: toIso(form.submissionDeadline),
    openingAt: toIso(form.openingAt),
    documentHtml: form.documentHtml || undefined,
  });

  const saveDraft = (thenPublish: boolean) => {
    if (!canManage) return;
    setError(null);
    const after = (t?: TenderResponse) => {
      if (thenPublish && t?.id) {
        setFeedback('文件已保存，请提交采购文件审查，通过后方可发布。');
        showDetail(t.id);
        refresh();
      } else {
        setFeedback('招标项目已保存(编制中)。');
        setView('list');
        refresh();
      }
    };
    if (editingId) {
      update.mutate({ tenderId: editingId, data: payload() }, { onSuccess: (r) => after(r.data), onError: reportError });
    } else {
      create.mutate({ data: payload() }, { onSuccess: (r) => after(r.data), onError: reportError });
    }
  };

  const openEdit = (t?: TenderResponse) => {
    if (!canManage) return;
    setError(null);
    if (t) {
      setEditingId(t.id ?? null);
      setForm({
        title: t.title ?? '',
        tenderType: t.tenderType ?? '公开招标',
        budget: t.budget != null ? String(t.budget) : '',
        evaluationMethod: t.evaluationMethod ?? '综合评分法',
        bidBondAmount: t.bidBondAmount != null ? String(t.bidBondAmount) : '',
        acquisitionDeadline: toLocal(t.acquisitionDeadline),
        submissionDeadline: toLocal(t.submissionDeadline),
        openingAt: toLocal(t.openingAt),
        documentHtml: t.documentHtml ?? '',
      });
    } else {
      setEditingId(null);
      setForm(emptyForm());
    }
    setView('edit');
  };

  const formValid =
    form.title.trim().length > 0 && (form.tenderType === '公开招标' || form.tenderType === '邀请招标');

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((t) => {
    if (statusFilter !== '全部' && t.status !== statusFilter) return false;
    return !kw || [t.title, t.tenderNo].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const countBy = (s: string) => all.filter((t) => t.status === s).length;

  const admitted = useMemo(() => suppliers.data?.data ?? [], [suppliers.data]);

  // ── 编制页 ─────────────────────────────────────────────────
  if (tenders.isError) return <FeedbackNotice tone="error" message="招标项目加载失败，请确认权限后重试。" />;
  if (view === 'detail' && !selected) return <div className="space-y-3">
    <FeedbackNotice tone={tenders.isLoading ? 'info' : 'error'} message={tenders.isLoading ? '正在加载招标项目…' : '未找到该招标项目或无权查看。'} />
    <ActionButton onClick={backToList} icon={ArrowLeft}>返回招标台账</ActionButton>
  </div>;
  if (view === 'edit' && canManage) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setView(editingId ? 'detail' : 'list')} aria-label="返回"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-950">{editingId ? '编辑招标项目' : '新建招标项目'}</h1>
              <p className="mt-0.5 text-xs font-bold text-slate-500">编制招标文件 → 发布后进入发售期,供应商领取文件</p>
            </div>
          </div>
        </div>

        {error && <FeedbackNotice tone="error" message={error} />}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <h3 className="text-base font-black text-slate-950">基本要素</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>招标项目名称</span>
              <input className={cn(inputCls, 'mt-1')} value={form.title} placeholder="如:2026年度机房设备公开招标"
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>招标方式</span>
              <select className={cn(inputCls, 'mt-1')} value={form.tenderType}
                onChange={(e) => setForm({ ...form, tenderType: e.target.value })}>
                <option value="公开招标">公开招标(全平台供应商可领取)</option>
                <option value="邀请招标">邀请招标(定向发放招标文件)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">预算金额(元)</span>
              <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">评标办法</span>
              <select className={cn(inputCls, 'mt-1')} value={form.evaluationMethod}
                onChange={(e) => setForm({ ...form, evaluationMethod: e.target.value })}>
                <option value="综合评分法">综合评分法</option>
                <option value="最低评标价法">最低评标价法</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">投标保证金(元,选填)</span>
              <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={form.bidBondAmount}
                onChange={(e) => setForm({ ...form, bidBondAmount: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">文件获取截止(发布前必填)</span>
              <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={form.acquisitionDeadline}
                onChange={(e) => setForm({ ...form, acquisitionDeadline: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">投标递交截止(发布前必填)</span>
              <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={form.submissionDeadline}
                onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">开标时间(发布前必填)</span>
              <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={form.openingAt}
                onChange={(e) => setForm({ ...form, openingAt: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <h3 className="text-base font-black text-slate-950">招标文件正文(发布前必填)</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">支持小标题、加粗、列表等富文本排版;附件(图纸/清单等)在项目详情页上传。</p>
          <div className="mt-3">
            <RichTextEditor
              value={form.documentHtml}
              onChange={(html) => setForm({ ...form, documentHtml: html })}
              placeholder="项目概况、投标人资格要求、评标办法细则、合同主要条款……"
              minHeight={260}
            />
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-slate-500">
              保存后提交采购文件审查；发布须审查通过并填写三个时间节点(获取截止 ≤ 递交截止 ≤ 开标时间)。
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={!formValid || create.isPending || update.isPending}
                onClick={() => saveDraft(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                保存草稿
              </button>
              <PrimaryActionButton flushTop size="md" onClick={() => saveDraft(true)}
                busy={create.isPending || update.isPending || publish.isPending} pendingLabel="发布中"
                disabled={!formValid}>
                <Send size={14} /> 保存并进入审查
              </PrimaryActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 详情页 ─────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const t = selected;
    const acquisitions = t.acquisitions ?? [];
    const acquiredCount = acquisitions.filter((a) => a.acquiredAt).length;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={backToList} aria-label="返回招标台账"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', typeTone[t.tenderType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {t.tenderType}
                </span>
                <h1 className="break-words text-xl font-black text-slate-950">{t.title}</h1>
                {t.status && <StatusPill label={t.status} />}
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {t.tenderNo} · 递交截止 {shortTime(t.submissionDeadline)} · 开标 {shortTime(t.openingAt)}
              </p>
            </div>
            <p className="shrink-0 font-mono text-xl font-black text-slate-950">{currency(t.budget)}</p>
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}
        {error && <FeedbackNotice tone="error" message={error} />}

        {/* 组织流程步进器:编制→发售→开标→评标→定标(与供应商端参与视图同口径) */}
        <BuyerTenderStepper tender={t} />
        <TenderDocumentReviewPanel tenderId={t.id!} drafting={t.status === '编制中'} canManage={canManage} />

        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">招标文件正文</h3>
              {t.documentHtml ? (
                <RichTextView html={t.documentHtml} className="mt-3" />
              ) : (
                <p className="mt-3 text-xs font-bold text-slate-400">正文尚未编制,点击底部「继续编制」补齐后方可发布。</p>
              )}
            </section>

            {t.id && (
              <OwnerAttachments ownerType="tender" ownerId={t.id} title="招标文件附件"
                readOnly={!canManage || t.status !== '编制中' || documentReview.data?.data?.reviews[0]?.status === 'processing'} onChanged={refresh}
                emptyHint="上传图纸、工程量清单、资格审查表等附件。" />
            )}

            {/* F-1 资格预审:编制阶段设定开关,发售阶段审查申请(通过方可领取招标文件) */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-slate-950">资格预审</h3>
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                  t.prequalificationRequired ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500')}>
                  {t.prequalificationRequired ? '实行资格预审' : '不实行资格预审'}
                </span>
              </div>
              {canManage && t.status === '编制中' ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="min-w-56 flex-1 text-xs font-bold text-slate-500">
                    开启后,供应商须先提交资格声明并经审查通过,方可领取招标文件与投标。发布发售后不得再变更。
                  </p>
                  <PrimaryActionButton size="sm" busy={setPrequalRequired.isPending} pendingLabel="保存中"
                    onClick={() => t.id && setPrequalRequired.mutate(
                      { tenderId: t.id, data: { required: !t.prequalificationRequired } },
                      {
                        onSuccess: () => {
                          setFeedback(t.prequalificationRequired ? '已取消资格预审要求。' : '已开启资格预审要求。');
                          refresh();
                        },
                        onError: reportError,
                      })}>
                    {t.prequalificationRequired ? '取消资格预审' : '开启资格预审'}
                  </PrimaryActionButton>
                </div>
              ) : (
                <p className="mt-2 text-xs font-bold text-slate-400">
                  {t.prequalificationRequired
                    ? '本项目实行资格预审,预审通过的供应商方可领取招标文件。'
                    : '本项目不实行资格预审,供应商可直接领取招标文件。'}
                </p>
              )}

              {t.prequalificationRequired && (
                (t.prequalifications ?? []).length === 0 ? (
                  <p className="mt-3 text-xs font-bold text-slate-400">尚无供应商提交资格预审申请。</p>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                        <tr>
                          <th className="px-3 py-2">供应商</th>
                          <th className="px-3 py-2">资格声明</th>
                          <th className="px-3 py-2">状态 / 审查意见</th>
                          <th className="px-3 py-2 text-right">审查</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(t.prequalifications ?? []).map((q) => {
                          const pending = q.status === '待审查';
                          const comment = prequalComments[q.id ?? ''] ?? '';
                          const doReview = (status: string) => t.id && q.id && reviewPrequal.mutate(
                            { tenderId: t.id, applicationId: q.id, data: { status, reviewComment: comment.trim() } },
                            {
                              onSuccess: () => {
                                setFeedback(`已完成资格预审:${q.supplierName ?? q.supplierId} ${status}。`);
                                setPrequalComments((cur) => ({ ...cur, [q.id ?? '']: '' }));
                                refresh();
                              },
                              onError: reportError,
                            });
                          return (
                            <tr key={q.id} className="align-top font-bold text-slate-700">
                              <td className="px-3 py-2 font-black text-slate-900">{q.supplierName ?? q.supplierId}</td>
                              <td className="px-3 py-2 whitespace-pre-wrap">{q.application}</td>
                              <td className="px-3 py-2">
                                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                                  q.status === '已通过' ? 'bg-emerald-50 text-emerald-700'
                                    : q.status === '未通过' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700')}>
                                  {q.status}
                                </span>
                                {q.reviewComment && <p className="mt-1 text-[11px] font-bold text-slate-500">{q.reviewComment}</p>}
                              </td>
                              <td className="px-3 py-2">
                                {canManage && pending && t.status === '发售中' ? (
                                  <div className="flex flex-col items-end gap-2">
                                    <input
                                      className="h-8 w-full min-w-40 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
                                      placeholder="审查意见(必填)" aria-label={`审查意见 ${q.supplierName ?? q.supplierId}`}
                                      value={comment}
                                      onChange={(e) => setPrequalComments((cur) => ({ ...cur, [q.id ?? '']: e.target.value }))} />
                                    <div className="flex gap-2">
                                      <button type="button" disabled={!comment.trim() || reviewPrequal.isPending}
                                        onClick={() => doReview('未通过')}
                                        className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                                        不通过
                                      </button>
                                      <PrimaryActionButton size="sm" busy={reviewPrequal.isPending} pendingLabel="提交中"
                                        disabled={!comment.trim()} onClick={() => doReview('已通过')}>
                                        通过
                                      </PrimaryActionButton>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-right text-[11px] font-bold text-slate-400">
                                    {pending ? '发售中方可审查' : '已审查'}
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-slate-950">发售与领取记录</h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                  发放 {acquisitions.length} 家 · 已领取 {acquiredCount} 家
                </span>
              </div>
              {acquisitions.length === 0 ? (
                <p className="mt-3 text-xs font-bold text-slate-400">
                  {t.tenderType === '邀请招标'
                    ? '尚未定向发放。发售中可在底部操作条选择已准入供应商发放。'
                    : '公开招标发售中,供应商在其门户自助领取后出现在此。'}
                </p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="px-3 py-2">供应商</th>
                        <th className="px-3 py-2">来源</th>
                        <th className="px-3 py-2 text-right">领取时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {acquisitions.map((a) => (
                        <tr key={a.supplierId} className="font-bold text-slate-700">
                          <td className="px-3 py-2 font-black text-slate-900">{a.supplierName ?? a.supplierId}</td>
                          <td className="px-3 py-2">{a.source}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {a.acquiredAt ? shortTime(a.acquiredAt) : '已发放 · 待领取'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {canManage && can('buyer:supplier:read') && t.tenderType === '邀请招标' && t.status === '发售中' && (
                <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                  <p className="text-xs font-black text-violet-800">定向发放招标文件(已准入供应商)</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {admitted.map((s) => {
                      const id = s.supplierId ?? '';
                      const already = acquisitions.some((a) => a.supplierId === id);
                      const checked = distributeIds.includes(id);
                      return (
                        <button key={id} type="button" disabled={already}
                          onClick={() => setDistributeIds((cur) => (checked ? cur.filter((x) => x !== id) : [...cur, id]))}
                          className={cn('rounded-lg border p-2.5 text-left text-xs font-black transition',
                            already ? 'border-slate-100 bg-slate-50 text-slate-300'
                              : checked ? 'border-violet-300 bg-violet-100 text-violet-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-violet-50')}>
                          {s.supplierName}{already ? '(已发放)' : ''}
                        </button>
                      );
                    })}
                  </div>
                  <PrimaryActionButton size="sm" onClick={() =>
                    t.id && distribute.mutate(
                      { tenderId: t.id, data: { supplierIds: distributeIds } },
                      {
                        onSuccess: () => { setFeedback(`已定向发放 ${distributeIds.length} 家。`); setDistributeIds([]); refresh(); },
                        onError: reportError,
                      },
                    )}
                    busy={distribute.isPending} pendingLabel="发放中" disabled={distributeIds.length === 0}>
                    发放招标文件({distributeIds.length})
                  </PrimaryActionButton>
                </div>
              )}
            </section>

            {/* C-2/C-3 投标递交与唱标:开标前内容密封仅见登记;开标后金额升序公示+指纹核验 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-slate-950">{t.openedAt ? '开标唱标' : '投标递交情况'}</h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                  {t.openedAt
                    ? `已开标 ${shortTime(t.openedAt)} · 已开启投标 ${(t.bids ?? []).filter((b) => b.sealedStatus === '已开启').length} 份`
                    : `密封在案 ${(t.bids ?? []).filter((b) => b.sealedStatus === '已密封').length} 份`}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                {t.openedAt
                  ? '解封时按投标内容复算 SHA-256 与递交时密封指纹比对:核验通过=内容未被篡改;已撤回的投标保留登记但不解封。'
                  : '开标前投标内容严格密封(报价与投标函不可见),此处仅为递交登记与密封指纹;到达开标时间后在底部操作条执行开标唱标。'}
              </p>
              {(t.bids ?? []).length === 0 ? (
                <p className="mt-3 text-xs font-bold text-slate-400">暂无投标递交。</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        {t.openedAt && <th className="w-10 px-3 py-2 text-center">名次</th>}
                        <th className="px-3 py-2">投标人</th>
                        {t.openedAt && <th className="px-3 py-2 text-right">投标报价</th>}
                        <th className="px-3 py-2">密封状态</th>
                        <th className="px-3 py-2">{t.openedAt ? '指纹核验' : '密封指纹'}</th>
                        <th className="px-3 py-2 text-right">递交时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(t.bids ?? []).map((b, i) => (
                        <tr key={b.id} className="font-bold text-slate-700">
                          {t.openedAt && (
                            <td className="px-3 py-2 text-center font-mono font-black text-slate-400">
                              {b.sealedStatus === '已开启' ? i + 1 : '—'}
                            </td>
                          )}
                          <td className="px-3 py-2 font-black text-slate-900">{b.supplierName ?? b.supplierId}</td>
                          {t.openedAt && (
                            <td className="px-3 py-2 text-right font-mono font-black text-slate-900">
                              {b.bidAmount != null ? currency(b.bidAmount) : '—'}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                              sealTone[b.sealedStatus ?? ''] ?? 'bg-slate-100 text-slate-500')}>
                              {b.sealedStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400" title={b.contentDigest ?? undefined}>
                            {t.openedAt ? (
                              b.digestVerified == null ? (
                                <span className="font-sans font-black text-slate-400">未解封</span>
                              ) : b.digestVerified ? (
                                <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-sans font-black text-emerald-700">核验通过</span>
                              ) : (
                                <span className="rounded-md bg-red-50 px-2 py-0.5 font-sans font-black text-red-600">指纹异常</span>
                              )
                            ) : (
                              <>{(b.contentDigest ?? '').slice(0, 16)}…</>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{shortTime(b.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* C-6 已流标:留痕卡 + 重新招标(评标/定标区隐藏) */}
            {t.status === '已流标' && (
              <section className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <h3 className="text-base font-black text-slate-950">流标留痕</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <MiniFact label="流标时间" value={shortTime(t.failedAt)} />
                  <MiniFact label="流标原因" value={t.failureReason ?? '—'} />
                </div>
                <p className="mt-2 text-[11px] font-bold text-slate-400">
                  发放/投标/评分记录保留在本项目备查;重新招标将复制标的要素与正文新建草稿(时间节点须重新设定)。
                </p>
                <PrimaryActionButton size="sm" disabled={!canManage} onClick={() =>
                  t.id && rebidTender.mutate({ tenderId: t.id }, {
                    onSuccess: (r) => {
                      setFeedback(`已按流标项目重新立项:「${r.data?.title}」(${r.data?.tenderNo}),请补齐时间节点后发布。`);
                      refresh();
                      if (r.data) openEdit(r.data);
                    },
                    onError: reportError,
                  })}
                  busy={rebidTender.isPending} pendingLabel="立项中">
                  重新招标
                </PrimaryActionButton>
              </section>
            )}
            {/* C-4 评标:开标后组建委员会并逐评委评分 */}
            {t.openedAt && t.status !== '已流标' && (
              <EvaluationSection tender={t} onFeedback={setFeedback} onError={setError} refresh={refresh} />
            )}
            {/* C-5 定标:推荐产生后可定标签章;已定标显示结果与通知书 */}
            {t.openedAt && t.status !== '已流标' && (
              <AwardSection tender={t} onFeedback={setFeedback} onError={setError} refresh={refresh} />
            )}
            {/* C-8 公告记录:发售/中标公示/流标自动同步门户 */}
            {t.id && <TenderAnnouncements tenderId={t.id} />}
          </div>

          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black"><Info size={15} className="text-blue-400" /> 关键信息</p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['招标编号', t.tenderNo ?? '—'],
                  ['评标办法', t.evaluationMethod ?? '—'],
                  ['投标保证金', t.bidBondAmount != null ? currency(t.bidBondAmount) : '不收取'],
                  ['文件获取截止', shortTime(t.acquisitionDeadline)],
                  ['投标递交截止', shortTime(t.submissionDeadline)],
                  ['开标时间', shortTime(t.openingAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>

        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <FileBadge size={14} className="shrink-0 text-blue-600" />
              <span>
                当前状态 <StatusPill label={t.status ?? '—'} />
                <span className="ml-2">
                  {t.status === '编制中'
                    ? '正文与时间节点齐备且采购文件审查通过后方可发布发售。'
                    : t.status === '发售中'
                      ? t.openingAt && new Date(t.openingAt) <= new Date()
                        ? '已到达约定开标时间,可执行开标唱标(解封密封投标并核验指纹)。'
                        : t.tenderType === '邀请招标' ? '可继续定向发放招标文件。' : '公开发售中,供应商自助领取。'
                      : t.status === '已开标'
                        ? '投标已解封唱标,可组建评标委员会进入评标。'
                        : t.status === '评标中'
                          ? '评标进行中:全体评委交卷后产生推荐中标人,即可定标并签章中标通知书。'
                          : t.status === '已定标'
                            ? '已定标:中标通知书已保存,签署状态见签署记录。'
                            : t.status === '已流标'
                              ? '已流标:留痕在案,可一键重新招标。'
                              : '发售已截止。'}
                </span>
              </span>
            </div>
            {canManage && t.status === '编制中' && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => openEdit(t)} disabled={documentReview.data?.data?.reviews[0]?.status === 'processing'}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50">
                  继续编制
                </button>
                <PrimaryActionButton flushTop size="md" onClick={() =>
                  t.id && publish.mutate({ tenderId: t.id },
                    { onSuccess: () => { setFeedback('招标文件已发布发售。'); refresh(); }, onError: reportError })}
                  busy={publish.isPending} pendingLabel="发布中" disabled={!documentReview.data?.data?.currentApproved}
                  disabledReason="当前采购文件尚未审查通过">
                  <Megaphone size={14} /> 发布发售
                </PrimaryActionButton>
              </div>
            )}
            {canManage && t.status === '发售中' && t.openingAt && new Date(t.openingAt) <= new Date() && (
              <PrimaryActionButton flushTop size="md" onClick={() =>
                t.id && openTender.mutate({ tenderId: t.id },
                  { onSuccess: () => { setFeedback('已开标:投标报价及指纹核验结果可在项目详情查看。'); refresh(); }, onError: reportError })}
                busy={openTender.isPending} pendingLabel="开标中">
                <Gavel size={14} /> 开标唱标
              </PrimaryActionButton>
            )}
            {canManage && (t.status === '已开标' || t.status === '评标中') && (
              failing ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <input
                    className="h-10 w-64 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-amber-400"
                    placeholder="流标原因(必填留痕)" aria-label="流标原因" value={failReason}
                    onChange={(e) => setFailReason(e.target.value)} />
                  <button type="button" disabled={!failReason.trim() || failTender.isPending}
                    onClick={() => t.id && failTender.mutate(
                      { tenderId: t.id, data: { reason: failReason.trim() } },
                      {
                        onSuccess: () => { setFeedback('已宣布流标(留痕在案),可重新招标。'); setFailing(false); setFailReason(''); refresh(); },
                        onError: reportError,
                      })}
                    className="inline-flex h-10 items-center rounded-lg bg-amber-600 px-4 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50">
                    {failTender.isPending ? '流标中…' : '确认流标'}
                  </button>
                  <button type="button" onClick={() => { setFailing(false); setFailReason(''); }}
                    className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50">
                    取消
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setFailing(true)}
                  className="inline-flex h-10 shrink-0 items-center rounded-lg border border-amber-200 bg-white px-4 text-sm font-black text-amber-700 hover:bg-amber-50">
                  宣布流标
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 台账 ───────────────────────────────────────────────────
  return (
    <Panel title="招标管理" icon={FileBadge} subtitle="招标文件编制 · 发售 · 领取(Track C · 2.0)">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部招标" value={String(all.length)} />
        <MiniFact label="编制中" value={String(countBy('编制中'))} />
        <MiniFact label="发售中" value={String(countBy('发售中'))} />
        <MiniFact label="公开招标" value={String(all.filter((t) => t.tenderType === '公开招标').length)} />
      </div>

      {feedback && <div className="mb-3"><FeedbackNotice tone="success" message={feedback} /></div>}
      {error && <div className="mb-3"><FeedbackNotice tone="error" message={error} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '编制中', '发售中', '评标中', '已定标', '已流标'].map((id) => ({
            id, label: id, count: id === '全部' ? undefined : countBy(id),
          }))}
          value={statusFilter}
          onChange={(id) => { setStatusFilter(id); setPage(1); }}
        />
        <SearchInput className="mb-0 ml-auto" placeholder="按项目名称 / 招标编号搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }} />
        {canManage && <button type="button" onClick={() => openEdit()}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800">
          <Plus size={15} /> 新建招标项目
        </button>}
      </div>

      {tenders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载招标项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info"
          message={kw || statusFilter !== '全部' ? '没有符合条件的招标项目。' : '暂无招标项目。点击右上角「新建招标项目」开始编制招标文件。'} />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((t, i) => (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>{t.title}
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{t.tenderNo}</p>
                  </div>
                  {t.status && <span className="shrink-0 whitespace-nowrap"><StatusPill label={t.status} /></span>}
                </div>
                <button type="button" onClick={() => t.id && showDetail(t.id)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50">
                  查看详情
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">招标项目</th>
                  <th className="px-5 py-4">招标方式</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">预算</th>
                  <th className="px-5 py-4 text-center">发放 / 领取</th>
                  <th className="px-5 py-4">递交截止</th>
                  <th className="sticky right-0 z-10 bg-slate-50 px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((t, i) => {
                  const acq = t.acquisitions ?? [];
                  return (
                    <tr key={t.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-56 truncate font-black text-slate-950" title={t.title ?? undefined}>{t.title}</p>
                        <p className="mt-1 w-56 truncate font-mono text-[11px] font-bold text-slate-400">{t.tenderNo}</p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', typeTone[t.tenderType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                          {t.tenderType}
                        </span>
                      </td>
                      <td className="px-5 py-5">{t.status && <StatusPill label={t.status} />}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(t.budget)}</td>
                      <td className="px-5 py-5 text-center font-mono text-xs font-black text-slate-600">
                        {acq.length > 0 ? `${acq.length} / ${acq.filter((a) => a.acquiredAt).length}` : '—'}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(t.submissionDeadline)}</td>
                      <td className="sticky right-0 z-10 bg-white px-5 py-5 text-right shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.3)]">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          {canManage && t.status === '编制中' && (
                            <button type="button" onClick={() => openEdit(t)}
                              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700">
                              继续编制
                            </button>
                          )}
                          <button type="button" onClick={() => t.id && showDetail(t.id)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                            详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
