import { useState } from 'react';
import { ChevronRight, Gauge } from 'lucide-react';
import { useBuyerSupplierList } from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, Pagination, Panel, SearchInput, StatusPill } from '@24bid/ui';

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400'];
const PAGE_SIZE = 8;

function scoreTone(score: number) {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

// 绩效看板:跨供应商绩效排名(评分降序)+ 生命周期标记 + 最近考核分。
export function SupplierPerformanceBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];
  const kw = keyword.toLowerCase();
  const scored = all
    .filter((s) => s.performanceScore != null)
    .filter((s) => !kw || (s.supplierName ?? '').toLowerCase().includes(kw))
    .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));

  const scores = scored.map((s) => s.performanceScore ?? 0);
  const avg =
    scores.length > 0 ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;
  const pageCount = Math.max(1, Math.ceil(scored.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = scored.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Panel title="绩效看板" icon={Gauge} subtitle="跨供应商绩效排名 · 分级 · 最近考核">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MiniFact label="已评分供应商" value={String(scored.length)} />
        <MiniFact label="平均绩效" value={avg == null ? '—' : String(avg)} />
        <MiniFact label="最高绩效" value={scores.length ? String(Math.max(...scores)) : '—'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CountTag>已评分 {scored.length} 家</CountTag>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按供应商名称搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载绩效数据…" />
      ) : scored.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword ? '没有符合条件的供应商。' : '暂无已评分供应商。'} />
      ) : (
        <>
        <div className="space-y-2">
          {pageItems.map((s, i) => {
            const rank = (safePage - 1) * PAGE_SIZE + i;
            const score = s.performanceScore ?? 0;
            return (
              <div
                key={s.id}
                onClick={() => s.id && onOpen(s.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
              >
                <span
                  className={`w-7 shrink-0 text-center font-mono text-lg font-black ${
                    RANK_COLORS[rank] ?? 'text-slate-300'
                  }`}
                >
                  {rank + 1}
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
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={scored.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
