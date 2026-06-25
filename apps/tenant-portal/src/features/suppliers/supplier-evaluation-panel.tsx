import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useBuyerSupplierListRelationQualifications,
  useSupplierEvaluationConfirmTier,
  useSupplierEvaluationCreateEvaluation,
  useSupplierEvaluationListEvaluations,
  useSupplierFulfillmentFulfillmentMetrics,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, PrimaryActionButton, StatusPill } from '@24bid/ui';

// 资质到期状态：已过期 / 即将到期(30天内) / 正常。
function qualificationAlert(expiresAt?: string): { label: string; tone: string } {
  if (!expiresAt) return { label: '无到期', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: '已过期', tone: 'bg-red-50 text-red-700 border-red-100' };
  if (days <= 30) return { label: `${days}天后到期`, tone: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: '正常', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}

const DIMENSIONS = [
  { key: 'qualityScore', label: '质量', weight: 0.35 },
  { key: 'deliveryScore', label: '交付', weight: 0.3 },
  { key: 'priceScore', label: '价格', weight: 0.2 },
  { key: 'serviceScore', label: '服务', weight: 0.15 },
] as const;

type DimKey = (typeof DIMENSIONS)[number]['key'];

function suggestTier(total: number): string {
  if (total >= 90) return '优选';
  if (total >= 75) return '合格';
  if (total >= 60) return '观察';
  return '淘汰';
}

export function SupplierEvaluationPanel({
  relationId,
  supplierId,
}: {
  relationId: string;
  supplierId?: string;
}) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<DimKey, number>>({
    qualityScore: 90,
    deliveryScore: 85,
    priceScore: 80,
    serviceScore: 85,
  });
  const [period, setPeriod] = useState('2026-Q3');

  const history = useSupplierEvaluationListEvaluations(relationId);
  const qualifications = useBuyerSupplierListRelationQualifications(relationId);
  const metrics = useSupplierFulfillmentFulfillmentMetrics(supplierId ?? '', {
    query: { enabled: !!supplierId },
  });
  const fulfillment = metrics.data?.data;
  const create = useSupplierEvaluationCreateEvaluation();
  const confirm = useSupplierEvaluationConfirmTier();

  const quals = qualifications.data?.data ?? [];

  const total = Math.round(
    DIMENSIONS.reduce((sum, d) => sum + scores[d.key] * d.weight, 0) * 100,
  ) / 100;
  const tier = suggestTier(total);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const submit = () =>
    create.mutate(
      { relationId, data: { period, ...scores, comment: '' } },
      { onSuccess: () => refresh() },
    );

  const evaluations = history.data?.data ?? [];

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <p className="text-sm font-black text-indigo-900">绩效考核</p>
      <p className="mt-0.5 text-xs font-bold text-indigo-600">
        四维加权 → 综合分 → 建议生命周期标记 → 采购方确认调级
      </p>

      {quals.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-black text-slate-500">资质证照 · 到期预警</p>
          <div className="mt-2 space-y-2">
            {quals.map((q) => {
              const alert = qualificationAlert(q.expiresAt);
              return (
                <div key={q.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-900">{q.qualificationType}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      {q.certificateNo} · 到期 {q.expiresAt ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-black leading-4 ${alert.tone}`}
                  >
                    {alert.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fulfillment && (fulfillment.receiptCount ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-black text-emerald-800">实测绩效（源自真实收货验收）</p>
            <button
              type="button"
              onClick={() =>
                setScores((s) => ({
                  ...s,
                  qualityScore: fulfillment.derivedQualityScore ?? s.qualityScore,
                  deliveryScore: fulfillment.derivedDeliveryScore ?? s.deliveryScore,
                }))
              }
              className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700"
            >
              回填到质量/交付评分
            </button>
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
          <label className="text-xs font-black text-slate-500">考核周期</label>
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {DIMENSIONS.map((d) => (
          <div key={d.key}>
            <label className="text-xs font-black text-slate-500">
              {d.label}（权重 {Math.round(d.weight * 100)}%）
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={scores[d.key]}
              onChange={(e) =>
                setScores((s) => ({ ...s, [d.key]: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MiniFact label="综合分(实时)" value={total.toFixed(2)} />
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
          <span className="text-[11px] font-black text-slate-400">建议标记</span>
          <StatusPill label={tier} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryActionButton onClick={submit} busy={create.isPending} pendingLabel="提交中" flushTop>
          提交考核单
        </PrimaryActionButton>
        <button
          type="button"
          onClick={() =>
            confirm.mutate(
              { relationId, data: { cooperationTier: tier, evaluationScore: total } },
              { onSuccess: () => refresh() },
            )
          }
          disabled={confirm.isPending}
          className="inline-flex h-9 items-center rounded-lg border border-indigo-200 bg-white px-4 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
        >
          {confirm.isPending ? '调级中' : `确认调级为「${tier}」`}
        </button>
      </div>

      {create.isError && (
        <div className="mt-3">
          <FeedbackNotice tone="error" message="提交失败：该周期可能已存在考核单。" />
        </div>
      )}

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
