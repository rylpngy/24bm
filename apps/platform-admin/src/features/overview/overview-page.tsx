import { Activity, ArrowRight, Building2, LayoutGrid, Megaphone, ShieldCheck, Store, TrendingUp, Wallet } from 'lucide-react';
import {
  usePlatformAnnouncementList,
  usePlatformEnterpriseListPendingReviews,
  usePlatformOverviewBusinessMetrics,
  usePlatformOverviewOverview,
  usePlatformTenantList,
} from '@24bid/api-client';
import { FeedbackNotice, MetricCard, MetricGrid, Panel, SectionCard, StatusPill, cn } from '@24bid/ui';

// 金额以「万元」呈现,平台看板量级大,避免长数字撑破卡片。
function wan(v?: number) {
  const n = Number(v ?? 0);
  if (n <= 0) return '¥0';
  return `¥${(n / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`;
}

// 平台工作台:经营看板(跨租户聚合)+ 租户/审核/公告总览。
export function OverviewPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const overview = usePlatformOverviewOverview();
  const tenants = usePlatformTenantList();
  const reviews = usePlatformEnterpriseListPendingReviews();
  const announcements = usePlatformAnnouncementList();
  const metrics = usePlatformOverviewBusinessMetrics();

  const o = overview.data?.data;
  const tenantList = tenants.data?.data ?? [];
  const reviewList = reviews.data?.data ?? [];
  const activeAnnouncements = (announcements.data?.data ?? []).filter((a) => a.status === 'active');
  const m = metrics.data?.data;
  const shares = m?.methodShares ?? [];
  const trends = m?.monthlyTrends ?? [];
  const shareTotal = shares.reduce((sum, x) => sum + (x.projectCount ?? 0), 0);
  const trendPeak = Math.max(1, ...trends.map((t) => Number(t.orderAmount ?? 0)));

  if (overview.isLoading) {
    return (
      <Panel title="平台工作台" icon={LayoutGrid} subtitle="租户 · 供应商 · 审核 · 公告总览">
        <FeedbackNotice tone="info" message="正在加载平台概览…" />
      </Panel>
    );
  }

  return (
    <Panel title="平台工作台" icon={LayoutGrid} subtitle="租户 · 供应商 · 审核 · 公告总览">
      <MetricGrid>
        <MetricCard icon={Building2} label="入驻租户" value={String(o?.tenantCount ?? 0)} hint={`启用 ${tenantList.filter((t) => t.status === 'active').length} 家`} tone="blue" />
        <MetricCard icon={Store} label="公共供应商" value={String(o?.publicSupplierCount ?? 0)} hint="平台可见供应商" tone="emerald" />
        <MetricCard icon={ShieldCheck} label="待审核企业" value={String(o?.pendingEnterpriseReviews ?? 0)} hint="入驻准入排队中" tone="amber" />
        <MetricCard icon={Megaphone} label="生效公告" value={String(activeAnnouncements.length)} hint="面向租户与供应商" tone="violet" />
      </MetricGrid>

      {/* 平台经营看板:跨租户真实聚合 */}
      <MetricGrid>
        <MetricCard icon={Wallet} label="累计交易额" value={wan(m?.orderAmount)} hint={`${m?.orderCount ?? 0} 笔采购订单`} tone="blue" />
        <MetricCard icon={TrendingUp} label="近 30 天成交" value={wan(m?.recentOrderAmount)} hint={`${m?.recentOrderCount ?? 0} 笔新增订单`} tone="emerald" />
        <MetricCard icon={Activity} label="活跃租户" value={String(m?.activeTenantCount ?? 0)} hint="近 30 天有立项或下单" tone="violet" />
        <MetricCard icon={Store} label="认证供应商" value={String(m?.verifiedSupplierCount ?? 0)} hint={`近 30 天新增 ${m?.recentSupplierCount ?? 0} 家`} tone="amber" />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard icon={TrendingUp} title="近 6 个月成交趋势">
          {trends.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无成交数据。" />
          ) : (
            <div className="space-y-2.5">
              {trends.map((t) => (
                <div key={t.month} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs font-black text-slate-400">{t.month}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-blue-500/80"
                      style={{ width: `${Math.max(2, (Number(t.orderAmount ?? 0) / trendPeak) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-xs font-black text-slate-900">{wan(t.orderAmount)}</span>
                  <span className="w-16 shrink-0 text-right text-[11px] font-bold text-slate-400">{t.orderCount ?? 0} 笔</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={LayoutGrid} title="采购方式分布">
          {shares.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无采购项目。" />
          ) : (
            <div className="space-y-3">
              {shares.map((x) => {
                const pct = shareTotal > 0 ? Math.round(((x.projectCount ?? 0) / shareTotal) * 100) : 0;
                return (
                  <div key={x.method}>
                    <div className="flex items-center justify-between gap-2 text-xs font-black">
                      <span className="text-slate-900">{x.method}采购</span>
                      <span className="text-slate-500">{x.projectCount ?? 0} 个项目 · {pct}% · 成交 {wan(x.orderAmount)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full',
                        x.method === '招标' ? 'bg-blue-500' : x.method === '竞价' ? 'bg-amber-500' : x.method === '商城' ? 'bg-violet-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] font-bold text-slate-400">
                合同累计 {m?.contractCount ?? 0} 份 · {wan(m?.contractAmount)}
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Building2 size={15} className="text-blue-600" /> 最近租户
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('tenants')}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-blue-600 hover:bg-slate-50"
            >
              租户管理 <ArrowRight size={13} />
            </button>
          </div>
          {tenantList.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无租户。可在「租户列表 · 企业开通」创建。" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3">序号</th>
                    <th className="px-4 py-3">租户</th>
                    <th className="px-4 py-3">套餐</th>
                    <th className="px-4 py-3 text-right">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tenantList.slice(0, 5).map((t, index) => (
                    <tr key={t.id} className="hover:bg-blue-50/30">
                      <td className="px-4 py-3 font-mono font-black text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-950">{t.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">{t.id}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">{t.plan ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusPill label={t.status === 'active' ? '已启用' : '已停用'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black text-slate-950">
              <ShieldCheck size={15} className="text-amber-600" /> 待审核企业
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('reviews')}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-blue-600 hover:bg-slate-50"
            >
              去审核 <ArrowRight size={13} />
            </button>
          </div>
          {reviewList.length === 0 ? (
            <FeedbackNotice tone="info" message="暂无在审企业。新企业提交入驻后出现在此。" />
          ) : (
            <div className="space-y-2">
              {reviewList.slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{e.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">{e.id}</p>
                  </div>
                  <StatusPill
                    label={
                      e.reviewStatus === 'preliminary' ? '初审通过' : e.reviewStatus === 'rejected' ? '已驳回' : '待初审'
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Panel>
  );
}
