import { useState } from 'react';
import {
  BarChart3,
  Download,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
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
  return compact
    ? `¥${(v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`
    : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;
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
  const query = useBuyerAnalyticsProcurement();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const data = query.data?.data;

  if (query.isLoading) {
    return <ShellState variant="loading" title="正在加载采购分析" desc="聚合订单、报价与品类支出…" />;
  }
  if (!data) {
    return <ShellState variant="error" title="采购分析加载失败" desc="请稍后重试或联系管理员。" />;
  }

  const monthly = (data.monthlySpend ?? []).slice(-12);
  const categories = data.categorySpend ?? [];
  const suppliers = data.supplierSpend ?? [];
  const statuses = data.statusDistribution ?? [];
  const categoryTotal = categories.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
  const totalSpend = data.totalSpend ?? 0;
  const savingsRate = totalSpend > 0 ? (((data.biddingSavings ?? 0) / totalSpend) * 100).toFixed(1) : null;

  const insights: string[] = [];
  if (categories[0]?.category && categoryTotal > 0) {
    insights.push(
      `支出最集中的品类是「${categories[0].category}」,占品类支出 ${(((categories[0].totalAmount ?? 0) / categoryTotal) * 100).toFixed(0)}%。`,
    );
  }
  if (data.topSupplierSharePercent != null && suppliers[0]?.supplierName) {
    insights.push(
      `头部供应商「${suppliers[0].supplierName}」占总支出 ${data.topSupplierSharePercent}%${
        data.topSupplierSharePercent >= 50 ? ',集中度偏高,建议扩充备选供应商。' : ',集中度可控。'
      }`,
    );
  }
  if (savingsRate != null && (data.biddingSavings ?? 0) > 0) {
    insights.push(`比价节支合计 ${currency(data.biddingSavings)},约占总支出 ${savingsRate}%。`);
  }

  const exportReport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      await downloadReport('/api/v1/buyer/reports/procurement-analytics?format=xlsx', '采购分析汇总.xlsx');
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Panel title="采购分析" icon={BarChart3} subtitle="支出趋势 · 品类结构 · 供应商集中度(后端真实聚合)">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-400">
          数据来源:采购订单、报价对比与需求行项的后端聚合,随业务实时更新。
        </p>
        <button
          type="button"
          disabled={exporting}
          onClick={exportReport}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          <Download size={14} /> {exporting ? '导出中…' : '导出报表(Excel)'}
        </button>
      </div>
      {exportError && (
        <div className="mb-3">
          <FeedbackNotice tone="error" message="报表导出失败,请稍后重试。" />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={WalletCards}
          label="累计支出"
          value={currency(data.totalSpend, true)}
          desc="订单口径合计"
          tone="bg-blue-50 text-blue-600"
        />
        <Kpi
          icon={BarChart3}
          label="订单数量"
          value={`${data.orderCount ?? 0} 单`}
          desc="累计采购订单"
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
          label="比价节支"
          value={currency(data.biddingSavings, true)}
          desc={savingsRate != null ? `约占支出 ${savingsRate}%` : '定标价与最高报价差额'}
          tone="bg-emerald-50 text-emerald-600"
        />
        <Kpi
          icon={Trophy}
          label="头部集中度"
          value={data.topSupplierSharePercent != null ? `${data.topSupplierSharePercent}%` : '—'}
          desc="支出最高供应商占比"
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
        <SectionCard icon={LineChartIcon} title="月度支出趋势" subtitle="按订单创建月聚合(近 12 个月)">
          {monthly.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无订单支出数据。" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthly.map((m) => ({
                    month: m.period,
                    amount: Math.round(((m.totalAmount ?? 0) / 10000) * 10) / 10,
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
                    formatter={(value, name) => (name === 'amount' ? [`${value} 万元`, '支出'] : [value ?? 0, '订单数'])}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} fill="url(#analyticsSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={PieChartIcon} title="品类支出占比" subtitle="需求行项 × 物料参考价,按物料分类聚合">
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
        <SectionCard icon={Users} title="供应商支出排行" subtitle="按订单金额聚合,含支出占比">
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
          label="月均支出"
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
    </Panel>
  );
}
