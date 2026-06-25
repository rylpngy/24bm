import { ListChecks, TrendingUp, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBuyerAnalyticsProcurement } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

const SUPPLIER_COLORS = ['#185FA5', '#1D9E75', '#BA7517', '#993556', '#534AB7'];

// 采购分析:总支出/订单/供应商/节支/集中度 KPI + 月度趋势 + 供应商支出 + 状态分布。
export function AnalyticsPage() {
  const query = useBuyerAnalyticsProcurement();
  const a = query.data?.data;

  if (query.isLoading) {
    return (
      <Panel title="采购分析" icon={TrendingUp} subtitle="支出趋势 · 集中度 · 节支洞察">
        <FeedbackNotice tone="info" message="正在加载采购分析…" />
      </Panel>
    );
  }
  if (!a) {
    return (
      <Panel title="采购分析" icon={TrendingUp} subtitle="支出趋势 · 集中度 · 节支洞察">
        <FeedbackNotice tone="info" message="暂无分析数据。" />
      </Panel>
    );
  }

  const monthly = (a.monthlySpend ?? []).map((m) => ({ period: m.period, amount: m.totalAmount ?? 0 }));
  const suppliers = (a.supplierSpend ?? []).slice(0, 5).map((s) => ({
    name: s.supplierName ?? s.supplierId ?? '—',
    amount: s.totalAmount ?? 0,
    share: s.sharePercent ?? 0,
  }));

  return (
    <div className="space-y-5">
      <Panel title="采购分析" icon={TrendingUp} subtitle="支出趋势 · 集中度 · 节支洞察">
        <div className="grid gap-2 sm:grid-cols-5">
          <MiniFact label="总支出" value={currency(a.totalSpend)} />
          <MiniFact label="采购订单" value={String(a.orderCount ?? 0)} />
          <MiniFact label="合作供应商" value={String(a.supplierCount ?? 0)} />
          <MiniFact label="比价节支" value={currency(a.biddingSavings)} />
          <MiniFact
            label="头部供应商集中度"
            value={a.topSupplierSharePercent != null ? `${a.topSupplierSharePercent}%` : '—'}
          />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="月度采购支出" icon={TrendingUp} subtitle="按订单创建月份汇总">
          {monthly.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无月度数据。" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={56}
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip formatter={(v) => currency(Number(v))} />
                <Bar dataKey="amount" fill="#185FA5" radius={[4, 4, 0, 0]} name="支出" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="供应商支出 Top5" icon={Users} subtitle="支出占比即集中度">
          {suppliers.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无供应商支出数据。" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={suppliers} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} width={96} />
                <Tooltip formatter={(v) => currency(Number(v))} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} name="支出">
                  {suppliers.map((_, i) => (
                    <Cell key={i} fill={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel title="订单状态分布" icon={ListChecks} subtitle="各状态订单数与金额">
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
              <tr>
                <th className="px-3 py-1.5">状态</th>
                <th className="px-3 py-1.5 text-right">订单数</th>
                <th className="px-3 py-1.5 text-right">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(a.statusDistribution ?? []).map((s) => (
                <tr key={s.status} className="font-bold text-slate-700">
                  <td className="px-3 py-1.5">{s.status}</td>
                  <td className="px-3 py-1.5 text-right">{s.orderCount}</td>
                  <td className="px-3 py-1.5 text-right font-black text-slate-900">{currency(s.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
