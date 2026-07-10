import { LayoutGrid } from 'lucide-react';
import { useSupplierWorkspaceLoad } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, StatusPill } from '@24bid/ui';

// 供应商看板:工作区聚合(商机/报价/订单/发票 + 通知)。
export function OverviewPage() {
  const ws = useSupplierWorkspaceLoad();
  const data = ws.data?.data;
  const notifications = data?.notifications ?? [];

  return (
    <div className="space-y-5">
      <Panel title="供应商看板" icon={LayoutGrid} subtitle="商机 · 报价 · 订单 · 应收">
        {ws.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载工作区…" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-4">
            <MiniFact label="待报价商机" value={String((data?.opportunities ?? []).length)} />
            <MiniFact label="我的报价" value={String((data?.quotes ?? []).length)} />
            <MiniFact label="销售订单" value={String((data?.orders ?? []).length)} />
            <MiniFact label="发票应收" value={String((data?.invoices ?? []).length)} />
          </div>
        )}
      </Panel>

      <Panel title="最新通知" icon={LayoutGrid} subtitle="采购方协作消息">
        {notifications.length === 0 ? (
          <FeedbackNotice tone="info" message="暂无通知。" />
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 8).map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-900">{n.title}</p>
                  <p className="mt-0.5 break-words text-xs font-bold text-slate-500">{n.content}</p>
                </div>
                <StatusPill label={n.read ? '已读' : '未读'} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
