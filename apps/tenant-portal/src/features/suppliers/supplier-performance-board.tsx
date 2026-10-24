import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Gauge, RefreshCw } from 'lucide-react';
import { listSupplierPerformanceComparison } from '@24bid/api-client';
import { FeedbackNotice, Pagination, Panel } from '@24bid/ui';
import { currentPerformanceQuarter, isPerformancePeriod } from './performance-period';

const PAGE_SIZE = 8;
const numberText = (value: number | null | undefined) => value == null ? '—' : String(value);
const percent = (value: number | null | undefined) => value == null ? '无样本' : `${value}%`;

export function SupplierPerformanceBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const [period, setPeriod] = useState(currentPerformanceQuarter);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const validPeriod = isPerformancePeriod(period);
  const query = useQuery({
    queryKey: ['/api/v1/buyer/suppliers/performance-comparison', period.trim()],
    enabled: validPeriod,
    queryFn: async ({ signal }) => {
      const result = await listSupplierPerformanceComparison(period.trim(), signal);
      if (!Array.isArray(result.data)) throw new Error('绩效响应不完整');
      return result;
    },
  });
  const all = validPeriod && !query.isError ? query.data?.data ?? [] : [];
  const rows = all.filter(row => row.supplierName.toLowerCase().includes(keyword.trim().toLowerCase()))
    .slice().sort((a, b) => a.totalScore == null ? (b.totalScore == null ? 0 : 1)
      : b.totalScore == null ? -1 : b.totalScore - a.totalScore);
  const scored = rows.filter(row => row.totalScore != null);
  const avg = scored.length ? Math.round(scored.reduce((sum, row) => sum + row.totalScore!, 0) / scored.length * 100) / 100 : null;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  return <Panel title="同期绩效对比" icon={Gauge} subtitle="">
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="w-full min-w-0 text-xs font-bold text-slate-600 sm:w-auto">考核周期
        <input aria-label="考核周期" value={period} placeholder="YYYY / YYYY-Q1 / YYYY-MM"
          onChange={event => { setPeriod(event.target.value); setPage(1); }}
          className="mt-1 block h-9 w-full rounded-md border border-slate-200 px-3 text-sm sm:w-56" />
      </label>
      <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">搜索供应商
        <input value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }}
          className="mt-1 block h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <button type="button" aria-label="刷新绩效" title="刷新绩效" disabled={!validPeriod || query.isFetching}
        onClick={() => void query.refetch()} className="h-9 rounded-md border border-slate-200 px-3 disabled:opacity-50"><RefreshCw size={16} /></button>
    </div>
    {!validPeriod ? <FeedbackNotice tone="error" message="请填写有效的比较周期：YYYY、YYYY-Q1 至 Q4 或 YYYY-MM。" />
      : query.isError ? <div className="space-y-3"><FeedbackNotice tone="error" message="绩效加载失败，请重试。" />
        <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="min-h-9 rounded-md border px-3 text-sm">重试</button></div>
      : query.isPending ? <FeedbackNotice tone="info" message="正在加载同期绩效…" />
      : <>
        <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
          <span>已考核 <strong aria-label="已考核数量">{scored.length}</strong></span>
          <span>平均绩效 <strong aria-label="平均绩效">{numberText(avg)}</strong></span>
          <span>最高绩效 <strong>{numberText(scored[0]?.totalScore)}</strong></span>
        </div>
        {rows.length === 0 ? <FeedbackNotice tone="info" message="没有符合条件的供应商。" /> :
          <ul className="divide-y divide-slate-200">
            {rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(row => <li key={row.relationId}
              className="grid min-w-0 gap-3 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-all text-sm text-slate-950">{row.supplierName}</strong>
                  <span className="text-xs font-bold text-blue-700">{row.totalScore == null ? '未考核' : `排名 ${scored.indexOf(row) + 1} · 综合 ${row.totalScore}`}</span>
                  <button type="button" aria-label={`查看${row.supplierName}`} title="查看供应商详情" onClick={() => onOpen(row.relationId)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200"><ChevronRight size={16} /></button>
                </div>
                <p className="mt-1 break-words text-xs text-slate-500">当前状态 {row.status || '—'} · 当前等级 {row.level || '—'} · 当前合作层级 {row.cooperationTier || '—'}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
                  <span>质量 {row.totalScore == null ? '—' : numberText(row.qualityScore)}</span>
                  <span>交付 {row.totalScore == null ? '—' : numberText(row.deliveryScore)}</span>
                  <span>价格 {row.totalScore == null ? '—' : numberText(row.priceScore)}</span>
                  <span>服务 {row.totalScore == null ? '—' : numberText(row.serviceScore)}</span>
                </div>
                <p title={row.evaluatedAt ?? undefined} className="mt-1 break-all text-xs text-slate-500">考核时间 {row.evaluatedAt?.slice(0, 16).replace('T', ' ') ?? '—'}</p>
              </div>
              <div className="min-w-0 space-y-1 break-words text-xs text-slate-600">
                <p>本期已登记收货准时率：{percent(row.onTimeRate)}</p>
                <p>合格率：{percent(row.qualifiedRate)}</p>
                <p>有预计日期 / 总验收：{numberText(row.scheduledReceiptCount)} / {numberText(row.receiptCount)} · 准时 {numberText(row.onTimeCount)}</p>
                <p>收货数量 / 合格数量：{numberText(row.totalReceived)} / {numberText(row.totalQualified)}</p>
                <p className="text-slate-400">按收货登记时间归属周期</p>
              </div>
            </li>)}
          </ul>}
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
      </>}
  </Panel>;
}
