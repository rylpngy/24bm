import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import {
  usePlatformTenantDisable,
  usePlatformTenantEnable,
  usePlatformTenantList,
} from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';

// 租户列表:采购企业与套餐/启停状态。
export function TenantsPage() {
  const queryClient = useQueryClient();
  const tenants = usePlatformTenantList();
  const enable = usePlatformTenantEnable();
  const disable = usePlatformTenantDisable();
  const [feedback, setFeedback] = useState<string | null>(null);

  const list = tenants.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/platform/tenants'),
    });

  const toggle = (tenantId: string, name: string, active: boolean) => {
    const m = active ? disable : enable;
    m.mutate(
      { tenantId },
      { onSuccess: () => { setFeedback(`租户「${name}」已${active ? '停用' : '启用'}`); refresh(); } },
    );
  };

  return (
    <Panel title="租户列表" icon={Building2} subtitle="采购企业 · 套餐 · 启停">
      <ListToolbar title="租户" recordCount={list.length} filterLabel="全部" actionLabel="入驻企业" />
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      {tenants.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载租户…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无租户。" />
      ) : (
        <div className="space-y-3">
          {list.map((t) => {
            const active = t.status === 'active';
            const busy =
              (enable.isPending && enable.variables?.tenantId === t.id) ||
              (disable.isPending && disable.variables?.tenantId === t.id);
            return (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">{t.name}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{t.id}</p>
                  </div>
                  <StatusPill label={active ? '已启用' : '已停用'} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="套餐" value={t.plan ?? '—'} />
                  <MiniFact label="用户上限" value={String(t.userLimit ?? '—')} />
                  <MiniFact label="启用功能数" value={String((t.enabledFeatures ?? []).length)} />
                </div>
                {(t.enabledFeatures ?? []).length > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-black text-slate-400">已启用功能</p>
                    <p className="mt-1 break-words text-xs font-bold text-slate-700">
                      {(t.enabledFeatures ?? []).join('、')}
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <button type="button" onClick={() => t.id && toggle(t.id, t.name ?? '', active)} disabled={busy}
                    className={
                      active
                        ? 'inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50'
                        : 'inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300'
                    }>
                    {busy ? '处理中' : active ? '停用租户' : '启用租户'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
