import { LayoutGrid } from 'lucide-react';
import { usePlatformOverviewOverview } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel } from '@24bid/ui';

// 平台看板:租户/供应商/待审核概览。
export function OverviewPage() {
  const overview = usePlatformOverviewOverview();
  const o = overview.data?.data;

  return (
    <Panel title="平台看板" icon={LayoutGrid} subtitle="租户 · 供应商 · 待审核概览">
      {overview.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载平台概览…" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniFact label="入驻租户数" value={String(o?.tenantCount ?? 0)} />
          <MiniFact label="公共供应商数" value={String(o?.publicSupplierCount ?? 0)} />
          <MiniFact label="待审核企业" value={String(o?.pendingEnterpriseReviews ?? 0)} />
        </div>
      )}
    </Panel>
  );
}
