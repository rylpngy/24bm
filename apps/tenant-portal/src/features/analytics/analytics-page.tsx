import { useState } from 'react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import {
  BarChart3,
  Download,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  Search,
  RotateCcw,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadReport, useBuyerAnalyticsProcurement } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, ShellState, cn } from '@24bid/ui';

const currency = (v?: number, compact = false) => {
  if (v == null) return '--';
  return compact && Math.abs(v) >= 10000
    ? `¥${(v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`
    : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const COLORS = ['#2563eb', '#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706'];

function Kpi({
  icon: Icon,
  label,
  value,
  desc,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  desc: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
        <Icon size={18} />
      </span>
      <p className="mt-3 text-[11px] font-black text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{desc}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-blue-600" />
        <h2 className="text-base font-black text-slate-950">{title}</h2>
      </div>
      <p className="mt-1 text-xs font-bold text-slate-400">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// 采购分析:全部指标来自后端真实聚合(订单/报价/需求行项),不含模拟数据。
export function AnalyticsPage() {
  const { can } = useBuyerPermissions();
  const canRead = can('buyer:analytics:read');
  const [filters, setFilters] = useState<{ fromDate?: string; toDate?: string; supplierId?: string; status?: string }>({});
  const [draft, setDraft] = useState(filters);
  const query = useBuyerAnalyticsProcurement(filters, { query: { enabled: canRead, staleTime: 60_000, refetchInterval: 60_000 } });
  const candidateQuery = useBuyerAnalyticsProcurement(
    { fromDate: filters.fromDate, toDate: filters.toDate },
    { query: { enabled: canRead, staleTime: 60_000, refetchInterval: 60_000 } },
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [format, setFormat] = useState('xlsx');
  const data = canRead && !query.isError && !query.isStale ? query.data?.data : undefined;
  const applied = data?.metadata?.appliedFilters;
  const displayedFromDate = draft.fromDate ?? applied?.fromDate ?? filters.fromDate ?? '';
  const displayedToDate = draft.toDate ?? applied?.toDate ?? filters.toDate ?? '';
  const selectedSupplier = draft.supplierId ?? filters.supplierId ?? '';
  const supplierCandidates = canRead && !query.isError && !candidateQuery.isError && !candidateQuery.isStale
    ? candidateQuery.data?.data?.supplierSpend ?? [] : [];
  const monthly = data?.monthlySpend ?? [];
  const categories = data?.categoryDemandEstimate ?? [];
  const suppliers = data?.supplierSpend ?? [];
  const statuses = data?.statusDistribution ?? [];
  const categoryTotal = categories.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
  const totalSpend = data?.totalSpend ?? 0;

  const insights: string[] = [];
  if (categories[0]?.category && categoryTotal > 0) {
    insights.push(
      `需求参考金额估算中「${categories[0].category}」占 ${(((categories[0].totalAmount ?? 0) / categoryTotal) * 100).toFixed(0)}%，与订单金额为独立总体。`,
    );
  }
  if (data?.topSupplierSharePercent != null && suppliers[0]?.supplierName) {
    insights.push(
      `头部供应商「${suppliers[0].supplierName}」占筛选订单金额 ${data.topSupplierSharePercent}%。`,
    );
  }
  if ((data?.biddingSavings ?? 0) > 0) {
    insights.push(`最高可比报价差额 ${currency(data?.biddingSavings)}，非审计节约额。`);
  }

  const exportReport = async () => {
    if (!canRead || !can('buyer:report:export') || !data || !applied) return;
    setExporting(true);
    setExportError(false);
    try {
      const params = new URLSearchParams({ format });
      for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
      await downloadReport(`/api/v1/buyer/reports/procurement-analytics?${params}`, `采购分析汇总.${format}`);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Panel title="采购分析" icon={BarChart3} subtitle="订单金额 · 供应商集中度 · 需求参考金额估算">
      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        setFilters(Object.fromEntries(Object.entries({ ...draft, fromDate: displayedFromDate, toDate: displayedToDate }).filter(([, value]) => value)));
        setExportError(false);
      }}>
        <label className="grid gap-1 text-xs text-slate-600">开始日期<input aria-label="开始日期" type="date" value={displayedFromDate} onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })} className="h-9 min-w-0 rounded border border-slate-200 px-2" /></label>
        <label className="grid gap-1 text-xs text-slate-600">结束日期<input aria-label="结束日期" type="date" value={displayedToDate} onChange={(event) => setDraft({ ...draft, toDate: event.target.value })} className="h-9 min-w-0 rounded border border-slate-200 px-2" /></label>
        <label className="grid gap-1 text-xs text-slate-600">供应商<select aria-label="供应商" value={selectedSupplier} onChange={(event) => setDraft({ ...draft, supplierId: event.target.value })} className="h-9 max-w-52 rounded border border-slate-200 px-2"><option value="">全部授权供应商</option>{selectedSupplier && !supplierCandidates.some((supplier) => supplier.supplierId === selectedSupplier) && <option value={selectedSupplier}>{selectedSupplier}</option>}{supplierCandidates.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-slate-600">订单状态<select aria-label="订单状态" value={draft.status ?? ''} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="h-9 rounded border border-slate-200 px-2"><option value="">全部状态</option>{Array.from(new Set(['待供应商确认', '待发货', '已发货', '已收货', '已取消', ...statuses.map((s) => s.status ?? '')])).filter(Boolean).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <button type="submit" disabled={!canRead} className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded border border-slate-200 px-3 text-xs font-bold"><Search size={14} />查询</button>
        <button type="button" aria-label="重置筛选" title="重置筛选" onClick={() => { setDraft({}); setFilters({}); }} className="flex h-9 w-9 items-center justify-center rounded border border-slate-200"><RotateCcw size={14} /></button>
      </form>
      {!canRead ? <ShellState variant="error" title="暂无采购分析权限" desc="请联系企业管理员核对权限。" /> : query.isError ? <ShellState variant="error" title="采购分析加载失败" desc="请检查日期范围（最多60个自然月）或稍后重试。" /> : !data ? <ShellState variant="loading" title="正在加载采购分析" desc="正在获取当前授权范围的订单统计。" /> : <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-400">
          {applied?.fromDate} 至 {applied?.toDate} · {data.metadata?.timezone} · {data.metadata?.definitionVersion} · {data.metadata?.scopeDescription}
          {' · '}供应商: {applied?.supplierId ?? '全部授权供应商'} · 状态: {applied?.status ?? '全部状态'}
        </p>
        <label className="text-xs text-slate-600">导出格式 <select aria-label="导出格式" value={format} onChange={(event) => setFormat(event.target.value)} className="h-9 rounded border border-slate-200 px-2"><option value="xlsx">Excel</option><option value="pdf">PDF</option></select></label>
        {can('buyer:report:export') && <button
          type="button"
          disabled={exporting || !applied}
          onClick={exportReport}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          <Download size={14} /> {exporting ? '导出中…' : '导出报表'}
        </button>}
      </div>
      {exportError && (
        <div className="mb-3">
          <FeedbackNotice tone="error" message="报表导出失败,请稍后重试。" />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={WalletCards}
          label="订单金额"
          value={currency(data.totalSpend, true)}
          desc="含所选状态，不代表已付款"
          tone="bg-blue-50 text-blue-600"
        />
        <Kpi
          icon={BarChart3}
          label="订单数量"
          value={`${data.orderCount ?? 0} 单`}
          desc="筛选日期内创建的订单"
          tone="bg-indigo-50 text-indigo-600"
        />
        <Kpi
          icon={Users}
          label="交易供应商"
          value={`${data.supplierCount ?? 0} 家`}
          desc="有订单往来的供应商"
          tone="bg-violet-50 text-violet-600"
        />
        <Kpi
          icon={TrendingUp}
          label="最高可比报价差额"
          value={currency(data.biddingSavings, true)}
          desc="当前轮有效定标，非审计节约额"
          tone="bg-emerald-50 text-emerald-600"
        />
        <Kpi
          icon={Trophy}
          label="头部集中度"
          value={data.topSupplierSharePercent != null ? `${data.topSupplierSharePercent}%` : '—'}
          desc="订单金额最高供应商占比"
          tone="bg-amber-50 text-amber-600"
        />
      </div>

      {insights.length > 0 && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-black text-blue-900">数据洞察(基于以上真实聚合计算)</p>
          <ul className="mt-2 space-y-1 text-xs font-bold text-blue-800">
            {insights.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard icon={LineChartIcon} title="月度订单金额" subtitle="筛选日期内按上海创建月聚合，含零订单月份">
          {monthly.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无订单金额数据。" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthly.map((m) => ({
                    month: m.period,
                    amount: (m.totalAmount ?? 0) / 10000,
                    orders: m.orderCount ?? 0,
                  }))}
                >
                  <defs>
                    <linearGradient id="analyticsSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                    unit="万"
                  />
                  <Tooltip
                    formatter={(value) => [currency(Number(value) * 10000), '订单金额']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} fill="url(#analyticsSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={PieChartIcon} title="需求参考金额估算" subtitle={data.metadata?.estimateBoundary ?? '独立需求总体，不代表历史订单品类金额'}>
          {categories.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无品类数据,请在物料目录维护分类与参考价。" />
          ) : (
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories.map((c) => ({ name: c.category, value: c.totalAmount ?? 0 }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {categories.map((c, index) => (
                        <Cell key={c.category} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => currency(typeof value === 'number' ? value : undefined)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-2">
                {categories.slice(0, 6).map((c, index) => (
                  <div key={c.category} className="flex items-center justify-between gap-2 text-xs font-bold">
                    <span className="flex min-w-0 items-center gap-2 text-slate-600">
                      <i
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate">{c.category}</span>
                    </span>
                    <span className="shrink-0 font-mono font-black text-slate-950">
                      {categoryTotal > 0 ? `${(((c.totalAmount ?? 0) / categoryTotal) * 100).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard icon={Users} title="供应商订单金额排行" subtitle="按筛选订单金额聚合，导出含完整排行">
          {suppliers.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无供应商交易数据。" />
          ) : (
            <div className="space-y-3">
              {suppliers.slice(0, 8).map((s, index) => (
                <div key={s.supplierId} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'w-6 text-center font-mono text-sm font-black',
                      index < 3 ? 'text-blue-600' : 'text-slate-300',
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="truncate text-slate-700">{s.supplierName}</span>
                      <span className="shrink-0 font-mono font-black text-slate-950">
                        {currency(s.totalAmount, true)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.max(4, s.sharePercent ?? 0)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] font-black text-slate-400">
                    {s.sharePercent != null ? `${s.sharePercent}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={BarChart3} title="订单状态分布" subtitle="按订单当前状态聚合数量与金额">
          {statuses.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无订单状态数据。" />
          ) : (
            <div className="space-y-2">
              {statuses.map((s) => (
                <div
                  key={s.status}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <span className="text-xs font-black text-slate-700">{s.status}</span>
                  <span className="text-xs font-bold text-slate-500">
                    {s.orderCount ?? 0} 单 ·{' '}
                    <span className="font-mono font-black text-slate-950">{currency(s.totalAmount, true)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniFact
          label="月均订单金额"
          value={
            monthly.length > 0
              ? currency(monthly.reduce((sum, m) => sum + (m.totalAmount ?? 0), 0) / monthly.length, true)
              : '—'
          }
        />
        <MiniFact
          label="单均金额"
          value={(data.orderCount ?? 0) > 0 ? currency(totalSpend / (data.orderCount ?? 1), true) : '—'}
        />
        <MiniFact label="品类数量" value={`${categories.length} 类`} />
      </div>
      <details className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-bold">统计定义与生成时间</summary>
        <p className="mt-2">{data.metadata?.orderAmountBasis}</p>
        <p className="mt-2">{data.metadata?.quoteDifferenceBasis}</p>
        <p className="mt-2">{data.metadata?.createdAt}</p>
      </details>
      </>}
    </Panel>
  );
}
