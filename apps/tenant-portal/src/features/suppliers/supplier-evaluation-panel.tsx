import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useSupplierEvaluationConfirmTier,
  getSupplierPeriodFulfillment,
} from '@24bid/api-client';
import { useScoredSupplierEvaluations, useCreateScoredSupplierEvaluation, useEvaluationTemplates, evaluationDimensions as DIMENSIONS, legacyScoring, templateScoring, scoringDescription, calculateEvaluationTotal } from '@24bid/api-client/supplier-evaluation-templates';
import { suggestTier } from '@24bid/shared';
import { FeedbackNotice, MiniFact, PrimaryActionButton, StatusPill } from '@24bid/ui';
import { currentPerformanceQuarter, isPerformancePeriod } from './performance-period';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

type DimKey = (typeof DIMENSIONS)[number]['key'];

export function SupplierEvaluationPanel({
  relationId,
  supplierId,
}: {
  relationId: string;
  supplierId?: string;
}) {
  const queryClient = useQueryClient();
  const canWrite = useBuyerPermissions().can('buyer:supplier:manage');
  const [scores, setScores] = useState<Record<DimKey, number | ''>>({
    qualityScore: '',
    deliveryScore: '',
    priceScore: '',
    serviceScore: '',
  });
  const [period, setPeriod] = useState(currentPerformanceQuarter);
  const [comment, setComment] = useState('');
  const [selectedEvaluation, setSelectedEvaluation] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const history = useScoredSupplierEvaluations(relationId);
  const templates = useEvaluationTemplates();
  const [templateVersionId, setTemplateVersionId] = useState('');
  const availableTemplates = (templates.data?.data ?? []).filter(t => t.enabled);
  const selectedTemplate = (templates.data?.data ?? []).find(t => t.id === templateVersionId);
  const scoring = selectedTemplate ? templateScoring(selectedTemplate) : legacyScoring;
  const templateReady = !templates.isPending && !templates.isError && (!templateVersionId || !!selectedTemplate?.enabled);
  const validPeriod = isPerformancePeriod(period);
  const metrics = useQuery({
    queryKey: ['/api/v1/buyer/suppliers', supplierId, 'fulfillment-metrics', period.trim()],
    queryFn: ({ signal }) => getSupplierPeriodFulfillment(supplierId!, period.trim(), signal),
    enabled: !!supplierId && validPeriod,
  });
  const periodMatches = metrics.data?.data?.period === period.trim();
  const fulfillment = validPeriod && !metrics.isError && !metrics.isFetching && periodMatches ? metrics.data?.data : undefined;
  const qualityAvailable = !!fulfillment && fulfillment.totalReceived > 0 && fulfillment.derivedQualityScore != null;
  const deliveryAvailable = !!fulfillment && fulfillment.scheduledReceiptCount > 0 && fulfillment.derivedDeliveryScore != null;
  const create = useCreateScoredSupplierEvaluation();
  const confirm = useSupplierEvaluationConfirmTier();

  const validScores = DIMENSIONS.every(d => scores[d.key] !== '' && Number.isFinite(scores[d.key]) && Number(scores[d.key]) >= 0 && Number(scores[d.key]) <= 100);
  const total = calculateEvaluationTotal(scores, scoring);
  const tier = suggestTier(total);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const evaluations = history.data?.data ?? [];
  const saved = evaluations.find(e => e.id === selectedEvaluation);
  const duplicate = evaluations.some(e => e.period === period.trim());
  const canSubmit = canWrite && templateReady && validPeriod && validScores && comment.trim().length > 0 && !duplicate && !history.isLoading && !history.isError;
  const failed = (error: unknown) => setFeedback({ tone: 'error', message: (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败，请重试。' });
  const submit = () => {
    if (!canSubmit || create.isPending) return;
    setFeedback(null);
    create.mutate(
      { relationId, data: { ...(templateVersionId ? { templateVersionId } : {}), period: period.trim(), qualityScore: Number(scores.qualityScore), deliveryScore: Number(scores.deliveryScore), priceScore: Number(scores.priceScore), serviceScore: Number(scores.serviceScore), comment: comment.trim() } },
      { onSuccess: response => { setSelectedEvaluation(response.data?.id ?? ''); setFeedback({ tone: 'success', message: '考核单已保存，合作层级尚未调整。' }); void refresh(); }, onError: failed },
    );
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <p className="text-sm font-black text-indigo-900">绩效考核</p>
      {feedback && <div className="mt-3"><FeedbackNotice {...feedback} /></div>}
      {history.isError && <FeedbackNotice tone="error" message="考核历史加载失败，暂不能提交或调级。" />}
      <label className="mt-3 block min-w-0 text-xs font-bold text-slate-600">考核模板
        <select aria-label="考核模板" value={templateVersionId} onChange={e => setTemplateVersionId(e.target.value)} disabled={!canWrite || create.isPending || templates.isPending || templates.isError} className="mt-1 h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm">
          <option value="">默认模板 · v0</option>
          {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name} · v{t.version}</option>)}
          {templateVersionId && !selectedTemplate?.enabled && <option value={templateVersionId}>所选模板已不可用</option>}
        </select>
      </label>
      {templates.isError && <div className="mt-2"><FeedbackNotice tone="error" message="模板加载失败，暂不能提交。" /><button type="button" onClick={() => void templates.refetch()} className="min-h-9 text-xs text-blue-700">重试模板</button></div>}
      <p className="mt-2 break-words text-xs text-slate-500">{templateReady ? scoringDescription(scoring) : '模板待确认'}</p>

      {supplierId && <section className="mt-3 border-y border-emerald-200 py-3">
        <p className="text-xs font-black text-emerald-800">所选周期履约参考</p>
        <p className="mt-1 text-xs text-slate-500">按收货登记时间归属周期</p>
        {!validPeriod ? <p className="mt-2 text-xs text-slate-500">请输入有效周期后查看。</p>
          : metrics.isError ? <><FeedbackNotice tone="error" message="履约参考加载失败，请重试。" />
            <button type="button" onClick={() => void metrics.refetch()} disabled={metrics.isFetching} className="mt-2 min-h-9 rounded-md border px-3 text-xs">重试履约参考</button></>
          : metrics.isPending || metrics.isFetching ? <p className="mt-2 text-xs text-slate-500">正在加载所选周期履约参考…</p>
          : !periodMatches ? <><FeedbackNotice tone="error" message="履约参考周期不一致，请刷新。" />
            <button type="button" onClick={() => void metrics.refetch()} className="mt-2 min-h-9 rounded-md border px-3 text-xs">刷新履约参考</button></>
          : !fulfillment || fulfillment.receiptCount === 0 ? <p className="mt-2 text-xs text-slate-500">所选周期暂无验收样本。</p>
          : <>
            <p className="mt-1 break-words text-xs text-slate-500">{fulfillment.period} · {fulfillment.startDate} 至 {fulfillment.endDateExclusive}（结束日期不含）</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <MiniFact label="合格率" value={fulfillment.qualifiedRate == null ? '无数量样本' : `${fulfillment.qualifiedRate}%`} />
              <MiniFact label="本期已登记收货准时率" value={fulfillment.onTimeRate == null ? '无预计日期样本' : `${fulfillment.onTimeRate}%`} />
              <MiniFact label="有预计日期 / 总验收" value={`${fulfillment.scheduledReceiptCount} / ${fulfillment.receiptCount}`} />
              <MiniFact label="收货数量 / 合格数量" value={`${fulfillment.totalReceived} / ${fulfillment.totalQualified}`} />
            </div>
            <button type="button" disabled={!canWrite || create.isPending || (!qualityAvailable && !deliveryAvailable)}
              onClick={() => {
                if (!canWrite || create.isPending || !fulfillment) return;
                setScores(current => ({ ...current,
                  qualityScore: qualityAvailable ? fulfillment.derivedQualityScore! : current.qualityScore,
                  deliveryScore: deliveryAvailable ? fulfillment.derivedDeliveryScore! : current.deliveryScore,
                }));
              }} className="mt-2 inline-flex min-h-9 items-center rounded-md border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-700 disabled:opacity-50">
              回填质量/交付
            </button>
          </>}
      </section>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>考核周期</label>
          <input
            aria-label="考核周期"
            disabled={!canWrite || create.isPending}
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setScores({ qualityScore: '', deliveryScore: '', priceScore: '', serviceScore: '' });
              setComment('');
              setFeedback(null);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <p className="mt-1 text-xs text-slate-500">年度 YYYY、季度 YYYY-Q1 至 Q4、月份 YYYY-MM</p>
          {!validPeriod && <p role="alert" className="text-xs text-red-700">请填写有效的考核周期。</p>}
          {duplicate && <p role="alert" className="text-xs text-amber-700">该周期已有考核单，请查看考核历史。</p>}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {DIMENSIONS.map((d) => (
          <div key={d.key}>
            <label className="text-xs font-black text-slate-500">
              {d.label}（权重 {scoring[d.weight]}%）
            </label>
            <input
              aria-label={`${d.label}（权重 ${scoring[d.weight]}%）`}
              disabled={!canWrite || create.isPending}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={scores[d.key]}
              onChange={(e) =>
                setScores((s) => ({ ...s, [d.key]: e.target.value === '' ? '' : Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        ))}
      </div>

      <label className="mt-3 block text-xs font-bold text-slate-600">
        考核依据 <span className="text-red-600">*</span>
        <textarea aria-label="考核依据" value={comment} onChange={e => setComment(e.target.value)} disabled={!canWrite || create.isPending} maxLength={2000}
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal" />
      </label>
      {canWrite && (!validScores || !comment.trim()) && <p className="mt-2 text-xs text-amber-700">请填写四项0至100分的评分及考核依据。</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MiniFact label="综合分(实时)" value={validScores && templateReady ? total.toFixed(2) : '—'} />
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
          <span className="text-[11px] font-black text-slate-400">建议标记</span>
          <StatusPill label={validScores && templateReady ? tier : '待评分'} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryActionButton onClick={submit} busy={create.isPending} pendingLabel="提交中" flushTop disabled={!canSubmit}>
          提交考核单
        </PrimaryActionButton>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
        <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">调级依据
          <select aria-label="调级依据" value={selectedEvaluation} onChange={e => setSelectedEvaluation(e.target.value)} disabled={!canWrite || confirm.isPending}
            className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm">
            <option value="">选择已保存的考核单</option>
            {evaluations.map(e => <option key={e.id} value={e.id}>{e.period} · {e.totalScore}分 · {e.suggestedTier}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            if (!canWrite || !saved?.suggestedTier || saved.totalScore == null || history.isError || confirm.isPending) return;
            setFeedback(null);
            confirm.mutate(
              { relationId, data: { cooperationTier: saved.suggestedTier, evaluationScore: saved.totalScore } },
              { onSuccess: () => { setFeedback({ tone: 'success', message: `已按${saved.period}考核结果调整合作层级。` }); void refresh(); }, onError: failed },
            );
          }}
          disabled={!canWrite || !saved?.suggestedTier || saved.totalScore == null || history.isError || history.isLoading || confirm.isPending}
          className="inline-flex h-9 items-center rounded-lg border border-indigo-200 bg-white px-4 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
        >
          {confirm.isPending ? '调级中' : '确认调级'}
        </button>
      </div>

      {evaluations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-black text-slate-500">考核历史</p>
          <div className="mt-2 space-y-2">
            {evaluations.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{e.period}</p>
                  <p className="mt-1 break-words text-xs text-slate-500">{scoringDescription(e.scoring)}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">
                    质 {e.qualityScore} · 交 {e.deliveryScore} · 价 {e.priceScore} · 服 {e.serviceScore}
                  </p>
                  {e.comment && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{e.comment}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-slate-900">{e.totalScore}</span>
                  {e.suggestedTier && <StatusPill label={e.suggestedTier} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
