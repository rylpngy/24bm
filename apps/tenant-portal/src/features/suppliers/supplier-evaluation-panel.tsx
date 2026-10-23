import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSupplierEvaluationConfirmTier,
  useSupplierEvaluationCreateEvaluation,
  useSupplierEvaluationListEvaluations,
  useSupplierFulfillmentFulfillmentMetrics,
} from '@24bid/api-client';
import { suggestTier } from '@24bid/shared';
import { FeedbackNotice, MiniFact, PrimaryActionButton, StatusPill } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const DIMENSIONS = [
  { key: 'qualityScore', label: '质量', weight: 0.35 },
  { key: 'deliveryScore', label: '交付', weight: 0.3 },
  { key: 'priceScore', label: '价格', weight: 0.2 },
  { key: 'serviceScore', label: '服务', weight: 0.15 },
] as const;

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
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  });
  const [comment, setComment] = useState('');
  const [selectedEvaluation, setSelectedEvaluation] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const history = useSupplierEvaluationListEvaluations(relationId);
  const metrics = useSupplierFulfillmentFulfillmentMetrics(supplierId ?? '', {
    query: { enabled: !!supplierId },
  });
  const fulfillment = metrics.data?.data;
  const create = useSupplierEvaluationCreateEvaluation();
  const confirm = useSupplierEvaluationConfirmTier();

  const validScores = DIMENSIONS.every(d => scores[d.key] !== '' && Number.isFinite(scores[d.key]) && Number(scores[d.key]) >= 0 && Number(scores[d.key]) <= 100);
  const total = Math.round(
    DIMENSIONS.reduce((sum, d) => sum + Number(scores[d.key]) * d.weight, 0) * 100,
  ) / 100;
  const tier = suggestTier(total);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const evaluations = history.data?.data ?? [];
  const saved = evaluations.find(e => e.id === selectedEvaluation);
  const validPeriod = /^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/.test(period.trim()) || /^\d{4}$/.test(period.trim());
  const duplicate = evaluations.some(e => e.period === period.trim());
  const canSubmit = canWrite && validPeriod && validScores && comment.trim().length > 0 && !duplicate && !history.isLoading && !history.isError;
  const failed = (error: unknown) => setFeedback({ tone: 'error', message: (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败，请重试。' });
  const submit = () => {
    if (!canSubmit || create.isPending) return;
    setFeedback(null);
    create.mutate(
      { relationId, data: { period: period.trim(), qualityScore: Number(scores.qualityScore), deliveryScore: Number(scores.deliveryScore), priceScore: Number(scores.priceScore), serviceScore: Number(scores.serviceScore), comment: comment.trim() } },
      { onSuccess: response => { setSelectedEvaluation(response.data?.id ?? ''); setFeedback({ tone: 'success', message: '考核单已保存，合作层级尚未调整。' }); void refresh(); }, onError: failed },
    );
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <p className="text-sm font-black text-indigo-900">绩效考核</p>
      {feedback && <div className="mt-3"><FeedbackNotice {...feedback} /></div>}
      {history.isError && <FeedbackNotice tone="error" message="考核历史加载失败，暂不能提交或调级。" />}

      {fulfillment && (fulfillment.receiptCount ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-black text-emerald-800">累计履约参考（非所选考核周期统计）</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canWrite || create.isPending}
                onClick={() =>
                  setScores((s) => ({
                    ...s,
                    qualityScore: fulfillment.derivedQualityScore ?? s.qualityScore,
                    deliveryScore: fulfillment.derivedDeliveryScore ?? s.deliveryScore,
                  }))
                }
                className="inline-flex h-7 items-center rounded-md border border-emerald-300 bg-white px-3 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
              >
                回填质量/交付
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <MiniFact
              label="实测质量分(合格率)"
              value={fulfillment.qualifiedRate != null ? `${fulfillment.qualifiedRate}` : '—'}
            />
            <MiniFact
              label="实测交付分(准时率)"
              value={fulfillment.onTimeRate != null ? `${fulfillment.onTimeRate}` : '—'}
            />
            <MiniFact
              label="验收单 / 准时"
              value={`${fulfillment.receiptCount} / ${fulfillment.onTimeCount}`}
            />
            <MiniFact
              label="收货 / 合格"
              value={`${fulfillment.totalReceived} / ${fulfillment.totalQualified}`}
            />
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>考核周期</label>
          <input
            aria-label="考核周期"
            disabled={!canWrite || create.isPending}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
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
              {d.label}（权重 {Math.round(d.weight * 100)}%）
            </label>
            <input
              aria-label={`${d.label}（权重 ${Math.round(d.weight * 100)}%）`}
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
        <MiniFact label="综合分(实时)" value={validScores ? total.toFixed(2) : '—'} />
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
          <span className="text-[11px] font-black text-slate-400">建议标记</span>
          <StatusPill label={validScores ? tier : '待评分'} />
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
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{e.period}</p>
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
