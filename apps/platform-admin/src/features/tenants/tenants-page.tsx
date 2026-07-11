import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, PauseCircle, Plus, Users } from 'lucide-react';
import {
  usePlatformTenantDisable,
  usePlatformTenantEnable,
  usePlatformTenantList,
  usePlatformTenantUpdateFeatures,
  usePlatformTenantUpdatePlan,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MetricCard,
  MetricGrid,
  Pagination,
  Panel,
  PrimaryActionButton,
  SearchInput,
  StatusPill,
} from '@24bid/ui';
import { TenantUsagePanel } from './tenant-usage-panel';
import { EnterpriseOnboardingPanel } from './enterprise-onboarding-panel';

const PLAN_OPTIONS = ['MVP', '标准版', '企业版'];
const FEATURE_DEFS = [
  { key: 'rfq', label: '询比 RFQ' },
  { key: 'order', label: '订单履约' },
  { key: 'finance', label: '财务付款' },
];
const PAGE_SIZE = 8;

// 租户列表:指标卡 + 工具条(筛选/搜索)+ 序号表格 + 分页,样式对齐采购端列表页。
export function TenantsPage() {
  const queryClient = useQueryClient();
  const tenants = usePlatformTenantList();
  const enable = usePlatformTenantEnable();
  const disable = usePlatformTenantDisable();
  const updatePlan = usePlatformTenantUpdatePlan();
  const updateFeatures = usePlatformTenantUpdateFeatures();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ plan: string; userLimit: string; features: string[] } | null>(null);
  const [usageId, setUsageId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const list = tenants.data?.data ?? [];
  const activeCount = list.filter((t) => t.status === 'active').length;
  const totalUserLimit = list.reduce((sum, t) => sum + (t.userLimit ?? 0), 0);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return list.filter((t) => {
      if (statusFilter === 'active' && t.status !== 'active') return false;
      if (statusFilter === 'inactive' && t.status === 'active') return false;
      if (kw && ![t.name, t.id, t.plan].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [list, statusFilter, keyword]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const focused = list.find((t) => t.id === editId || t.id === usageId);

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
    setUsageId(null);
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
    <div className="space-y-4">
      <Panel title="租户列表" icon={Building2} subtitle="采购企业 · 套餐 · 启停 · 用量计费">
        <MetricGrid>
          <MetricCard icon={Building2} label="入驻租户" value={String(list.length)} hint="含已停用" tone="blue" />
          <MetricCard icon={CheckCircle2} label="已启用" value={String(activeCount)} hint="正常服务中" tone="emerald" />
          <MetricCard icon={PauseCircle} label="已停用" value={String(list.length - activeCount)} hint="暂停服务" tone="slate" />
          <MetricCard icon={Users} label="用户席位合计" value={String(totalUserLimit)} hint="各租户上限之和" tone="violet" />
        </MetricGrid>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterTabs
            items={[
              { id: 'all', label: '全部', count: list.length },
              { id: 'active', label: '已启用', count: activeCount },
              { id: 'inactive', label: '已停用', count: list.length - activeCount },
            ]}
            value={statusFilter}
            onChange={(id) => { setStatusFilter(id); setPage(1); }}
          />
          <SearchInput
            className="mb-0 ml-auto"
            placeholder="按名称 / 租户 ID / 套餐搜索"
            onSearch={(k) => { setKeyword(k); setPage(1); }}
          />
          <button
            type="button"
            onClick={() => setShowOnboarding((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> {showOnboarding ? '收起开通' : '开通新企业'}
          </button>
        </div>

        {showOnboarding && (
          <div className="mb-4">
            <EnterpriseOnboardingPanel embedded />
          </div>
        )}

        {feedback && (
          <div className="mb-4">
            <FeedbackNotice tone="success" message={feedback} />
          </div>
        )}

        {tenants.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载租户…" />
        ) : filtered.length === 0 ? (
          <FeedbackNotice tone="info" message={keyword || statusFilter !== 'all' ? '没有符合条件的租户。' : '暂无租户,可通过上方「企业开通」创建。'} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3">序号</th>
                    <th className="px-4 py-3">租户</th>
                    <th className="px-4 py-3">套餐</th>
                    <th className="px-4 py-3 text-right">用户上限</th>
                    <th className="px-4 py-3">启用功能</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pageItems.map((t, index) => {
                    const active = t.status === 'active';
                    const busy =
                      (enable.isPending && enable.variables?.tenantId === t.id) ||
                      (disable.isPending && disable.variables?.tenantId === t.id);
                    return (
                      <tr key={t.id} className="font-bold text-slate-700 hover:bg-blue-50/30">
                        <td className="px-4 py-4 font-mono font-black text-slate-400">
                          {(safePage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">{t.name}</p>
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">{t.id}</p>
                        </td>
                        <td className="px-4 py-4 text-xs">{t.plan ?? '—'}</td>
                        <td className="px-4 py-4 text-right font-mono">{t.userLimit ?? '—'}</td>
                        <td className="max-w-52 px-4 py-4">
                          <p className="truncate text-xs text-slate-500">
                            {(t.enabledFeatures ?? []).join('、') || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill label={active ? '已启用' : '已停用'} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => (editId === t.id ? setEditId(null) : startEdit(t))}
                              className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              {editId === t.id ? '收起' : '编辑'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditId(null); setUsageId((cur) => (cur === t.id ? null : t.id ?? null)); }}
                              className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                            >
                              用量
                            </button>
                            <button
                              type="button"
                              onClick={() => t.id && toggle(t.id, t.name ?? '', active)}
                              disabled={busy}
                              className={
                                active
                                  ? 'inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-2.5 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50'
                                  : 'inline-flex h-8 items-center rounded-md bg-emerald-600 px-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300'
                              }
                            >
                              {busy ? '处理中' : active ? '停用' : '启用'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}

        {usageId && focused?.id && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-black text-slate-900">「{focused.name}」用量与计费</p>
            <TenantUsagePanel tenantId={focused.id} />
          </div>
        )}

        {editId && draft && focused && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
            <p className="text-sm font-black text-blue-800">「{focused.name}」套餐与功能开关</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-black text-slate-500">套餐</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  value={draft.plan}
                  onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500">用户上限</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  value={draft.userLimit}
                  onChange={(e) => setDraft({ ...draft, userLimit: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-black text-slate-500">功能开关</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {FEATURE_DEFS.map((f) => (
                  <label key={f.key} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={draft.features.includes(f.key)} onChange={() => toggleFeature(f.key)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <PrimaryActionButton
              onClick={() => focused.id && saveConfig(focused.id)}
              busy={updatePlan.isPending || updateFeatures.isPending}
              pendingLabel="保存中"
            >
              保存配置
            </PrimaryActionButton>
          </div>
        )}
      </Panel>
    </div>
  );
}
