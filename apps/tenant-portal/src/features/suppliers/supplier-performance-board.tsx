import { ChevronRight, Gauge } from 'lucide-react';
import { useBuyerSupplierList } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, StatusPill } from '@24bid/ui';

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400'];

function scoreTone(score: number) {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

// 绩效看板:跨供应商绩效排名(评分降序)+ 生命周期标记 + 最近考核分。
export function SupplierPerformanceBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];
  const scored = all
    .filter((s) => s.performanceScore != null)
    .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));

  const scores = scored.map((s) => s.performanceScore ?? 0);
  const avg =
    scores.length > 0 ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;

  return (
    <Panel title="绩效看板" icon={Gauge} subtitle="跨供应商绩效排名 · 分级 · 最近考核">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MiniFact label="已评分供应商" value={String(scored.length)} />
        <MiniFact label="平均绩效" value={avg == null ? '—' : String(avg)} />
        <MiniFact label="最高绩效" value={scores.length ? String(Math.max(...scores)) : '—'} />
      </div>

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载绩效数据…" />
      ) : scored.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无已评分供应商。" />
      ) : (
        <div className="space-y-2">
          {scored.map((s, i) => {
            const score = s.performanceScore ?? 0;
            return (
              <div
                key={s.id}
                onClick={() => s.id && onOpen(s.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
              >
                <span
                  className={`w-7 shrink-0 text-center font-mono text-lg font-black ${
                    RANK_COLORS[i] ?? 'text-slate-300'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-black text-slate-950">{s.supplierName}</p>
                    {s.cooperationTier && <StatusPill label={s.cooperationTier} />}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 max-w-[220px] flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${scoreTone(score)}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-bold text-slate-400">
                      最近考核 {s.lastEvaluationScore ?? '—'}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-lg font-black text-slate-900">{score}</span>
                <ChevronRight size={15} className="shrink-0 text-slate-300" />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
