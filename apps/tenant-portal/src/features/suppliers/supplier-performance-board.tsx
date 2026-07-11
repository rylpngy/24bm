import { useState } from 'react';
import { Award, ChevronRight, Gauge, Star, TrendingUp } from 'lucide-react';
import { useBuyerSupplierList } from '@24bid/api-client';
import { FeedbackNotice, Pagination, Panel, SearchInput, StatusPill } from '@24bid/ui';

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400'];
const PAGE_SIZE = 8;

function scoreLevel(score: number) {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '关注';
  return '预警';
}

function scoreBadgeTone(score: number) {
  if (score >= 90) return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (score >= 75) return 'border-blue-100 bg-blue-50 text-blue-700';
  if (score >= 60) return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-red-100 bg-red-50 text-red-700';
}

function metricTone(value: number) {
  if (value >= 90) return 'text-emerald-600';
  if (value >= 75) return 'text-blue-600';
  if (value >= 60) return 'text-amber-600';
  return 'text-red-600';
}

const summaryItems = [
  { key: 'scored', label: '已评分', icon: Gauge, tone: 'text-blue-600 bg-blue-50' },
  { key: 'avg', label: '平均绩效', icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50' },
  { key: 'top', label: '最高绩效', icon: Star, tone: 'text-amber-600 bg-amber-50' },
  { key: 'aLevel', label: 'A 级', icon: Award, tone: 'text-violet-600 bg-violet-50' },
] as const;

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {summaryItems.map((item) => {
            const Icon = item.icon;
            const value =
              item.key === 'scored'
                ? scored.length
                : item.key === 'avg'
                  ? avg == null
                    ? '—'
                    : avg
                  : item.key === 'top'
                    ? scores.length
                      ? Math.max(...scores)
                      : '—'
                    : all.filter((s) => s.level === 'A').length;

            return (
              <span
                key={item.key}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 shadow-sm shadow-slate-200/40"
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-md ${item.tone}`}>
                  <Icon size={12} />
                </span>
                {item.label}
                <strong className="font-mono text-sm text-slate-950">{value}</strong>
              </span>
            );
          })}
        </div>
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="hidden grid-cols-[48px_minmax(220px,1.5fr)_120px_minmax(260px,1.2fr)_110px_32px] items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-500 lg:grid">
            <span>排名</span>
            <span>供应商</span>
            <span>综合评级</span>
            <span>评分构成(综合 / 最近实测)</span>
            <span>最近考核</span>
            <span />
          </div>
          {pageItems.map((s, i) => {
            const rank = (safePage - 1) * PAGE_SIZE + i;
            const score = s.performanceScore ?? 0;
            const lastEvaluation = s.lastEvaluationScore;
            const delta = lastEvaluation != null ? Math.round((lastEvaluation - score) * 10) / 10 : null;
            return (
              <div
                key={s.id}
                onClick={() => s.id && onOpen(s.id)}
                className="grid cursor-pointer gap-3 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-blue-50/30 lg:grid-cols-[48px_minmax(220px,1.5fr)_120px_minmax(260px,1.2fr)_110px_32px] lg:items-center"
              >
                <span
                  className={`w-7 text-center font-mono text-lg font-black ${
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
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {s.categories?.slice(0, 2).join('、') || '未维护品类'} · 供应商等级 {s.level ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="lg:hidden text-[11px] font-black text-slate-400">综合评级</p>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-black ${scoreBadgeTone(score)}`}
                  >
                    <strong className="font-mono text-base leading-none">{score}</strong>
                    {scoreLevel(score)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-black text-slate-500">
                  <span className="whitespace-nowrap">
                    综合 <strong className={`font-mono text-sm ${metricTone(score)}`}>{score}</strong>
                  </span>
                  <span className="hidden text-slate-200 sm:inline">|</span>
                  <span className="whitespace-nowrap">
                    最近实测{' '}
                    <strong className={`font-mono text-sm ${lastEvaluation != null ? metricTone(lastEvaluation) : 'text-slate-300'}`}>
                      {lastEvaluation ?? '—'}
                    </strong>
                  </span>
                  {delta != null && (
                    <span className={`whitespace-nowrap font-mono ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {delta >= 0 ? '↗' : '↘'}{Math.abs(delta)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="lg:hidden text-[11px] font-black text-slate-400">最近考核</p>
                  <p className="font-mono text-sm font-black text-slate-700">{s.lastEvaluationScore ?? '—'}</p>
                </div>
                <ChevronRight size={15} className="text-slate-300" />
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
