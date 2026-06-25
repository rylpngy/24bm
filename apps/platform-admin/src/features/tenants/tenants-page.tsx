import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import {
  usePlatformTenantDisable,
  usePlatformTenantEnable,
  usePlatformTenantList,
  usePlatformTenantUpdateFeatures,
  usePlatformTenantUpdatePlan,
} from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';
import { TenantUsagePanel } from './tenant-usage-panel';

const PLAN_OPTIONS = ['MVP', '标准版', '企业版'];
const FEATURE_DEFS = [
  { key: 'rfq', label: '询价 RFQ' },
  { key: 'order', label: '订单履约' },
  { key: 'finance', label: '财务付款' },
];

// 租户列表:采购企业与套餐/功能/启停状态 + 套餐与功能开关编辑。
export function TenantsPage() {
  const queryClient = useQueryClient();
  const tenants = usePlatformTenantList();
  const enable = usePlatformTenantEnable();
  const disable = usePlatformTenantDisable();
  const updatePlan = usePlatformTenantUpdatePlan();
  const updateFeatures = usePlatformTenantUpdateFeatures();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ plan: string; userLimit: string; features: string[] } | null>(null);
  const [usageId, setUsageId] = useState<string | null>(null);

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

  const startEdit = (t: (typeof list)[number]) => {
    setEditId(t.id ?? null);
    setDraft({
      plan: t.plan ?? 'MVP',
      userLimit: String(t.userLimit ?? 10),
      features: [...(t.enabledFeatures ?? [])],
    });
  };

  const toggleFeature = (key: string) =>
    setDraft((d) =>
      d ? { ...d, features: d.features.includes(key) ? d.features.filter((k) => k !== key) : [...d.features, key] } : d,
    );

  const saveConfig = (tenantId: string) => {
    if (!draft) return;
    updatePlan.mutate(
      { tenantId, data: { plan: draft.plan, userLimit: Number(draft.userLimit) || 1 } },
      {
        onSuccess: () => {
          updateFeatures.mutate(
            { tenantId, data: { enabledFeatures: draft.features } },
            {
              onSuccess: () => {
                setFeedback('租户套餐与功能开关已更新');
                setEditId(null);
                refresh();
              },
            },
          );
        },
      },
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => t.id && toggle(t.id, t.name ?? '', active)} disabled={busy}
                    className={
                      active
                        ? 'inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50'
                        : 'inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300'
                    }>
                    {busy ? '处理中' : active ? '停用租户' : '启用租户'}
                  </button>
                  <button type="button" onClick={() => (editId === t.id ? setEditId(null) : startEdit(t))}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
                    {editId === t.id ? '收起编辑' : '编辑套餐/功能'}
                  </button>
                  <button type="button" onClick={() => setUsageId((cur) => (cur === t.id ? null : t.id ?? null))}
                    className="inline-flex h-9 items-center rounded-lg border border-indigo-200 bg-white px-4 text-xs font-black text-indigo-700 hover:bg-indigo-50">
                    {usageId === t.id ? '收起用量计费' : '用量与计费'}
                  </button>
                </div>
                {usageId === t.id && t.id && <TenantUsagePanel tenantId={t.id} />}

                {editId === t.id && draft && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                    <p className="text-xs font-black text-blue-800">套餐与功能开关</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-black text-slate-500">套餐</label>
                        <select
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          value={draft.plan}
                          onChange={(e) => setDraft({ ...draft, plan: e.target.value })}>
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-500">用户上限</label>
                        <input type="number" min={1}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          value={draft.userLimit}
                          onChange={(e) => setDraft({ ...draft, userLimit: e.target.value })} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] font-black text-slate-500">功能开关</p>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {FEATURE_DEFS.map((f) => (
                          <label key={f.key} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={draft.features.includes(f.key)}
                              onChange={() => toggleFeature(f.key)} />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <PrimaryActionButton onClick={() => t.id && saveConfig(t.id)}
                      busy={updatePlan.isPending || updateFeatures.isPending} pendingLabel="保存中">
                      保存配置
                    </PrimaryActionButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
