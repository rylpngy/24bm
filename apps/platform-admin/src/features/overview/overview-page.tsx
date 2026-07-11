import { ArrowRight, Building2, LayoutGrid, Megaphone, ShieldCheck, Store } from 'lucide-react';
import {
  usePlatformAnnouncementList,
  usePlatformEnterpriseListPendingReviews,
  usePlatformOverviewOverview,
  usePlatformTenantList,
} from '@24bid/api-client';
import { FeedbackNotice, MetricCard, MetricGrid, Panel, StatusPill } from '@24bid/ui';

// 平台工作台:KPI 总览 + 最近租户 + 待审核企业(样式对齐采购端工作台)。
export function OverviewPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const overview = usePlatformOverviewOverview();
  const tenants = usePlatformTenantList();
  const reviews = usePlatformEnterpriseListPendingReviews();
  const announcements = usePlatformAnnouncementList();

  const o = overview.data?.data;
  const tenantList = tenants.data?.data ?? [];
  const reviewList = reviews.data?.data ?? [];
  const activeAnnouncements = (announcements.data?.data ?? []).filter((a) => a.status === 'active');

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
