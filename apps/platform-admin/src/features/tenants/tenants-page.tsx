import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, PauseCircle, Plus, Users } from 'lucide-react';
import {
  usePlatformTenantDisable,
  usePlatformTenantEnable,
  usePlatformTenantList,
  axiosInstance,
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

type Catalog = { plans: { code: string; label: string }[]; features: { key: string; label: string; configurable?: boolean }[];
  methods: { featureKey: string; label: string }[] };
const PAGE_SIZE = 8;

// 租户列表:指标卡 + 工具条(筛选/搜索)+ 序号表格 + 分页,样式对齐采购端列表页。
export function TenantsPage({ canManage = false, canReadUsage = false, canCreateSupplier = false }:
  { canManage?: boolean; canReadUsage?: boolean; canCreateSupplier?: boolean }) {
  const queryClient = useQueryClient();
  const tenants = usePlatformTenantList();
  const enable = usePlatformTenantEnable();
  const disable = usePlatformTenantDisable();
  const catalog = useQuery({ queryKey: ['/api/v1/platform/tenants/configuration-catalog'], enabled: canManage,
    queryFn: async ({ signal }) => (await axiosInstance.get<{ data: Catalog }>('/api/v1/platform/tenants/configuration-catalog', { signal })).data.data });
  const updateConfiguration = useMutation({ mutationFn: ({ tenantId, data }: { tenantId: string; data: { plan: string; userLimit: number; enabledFeatures: string[] } }) =>
    axiosInstance.put(`/api/v1/platform/tenants/${encodeURIComponent(tenantId)}/configuration`, data) });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ plan: string; userLimit: string; features: string[] } | null>(null);
  const [usageId, setUsageId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const list = tenants.isError ? [] : tenants.data?.data ?? [];
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
    if (!canManage) return;
    setError(null); setFeedback(null);
    const m = active ? disable : enable;
    m.mutate(
      { tenantId },
      { onSuccess: () => { setFeedback(`租户「${name}」已${active ? '停用' : '启用'}`); refresh(); }, onError: reportError },
    );
  };

  const startEdit = (t: (typeof list)[number]) => {
    setUsageId(null);
    setEditId(t.id ?? null);
    setDraft({
      plan: ({ '标准版': 'Growth', '企业版': 'Enterprise' } as Record<string, string>)[t.plan ?? ''] ?? t.plan ?? 'MVP',
      userLimit: String(t.userLimit ?? 10),
      features: [...(t.enabledFeatures ?? [])],
    });
  };

  const toggleFeature = (key: string) => setDraft(d => {
    if (!d) return d;
    const features = d.features.includes(key) || (key === 'method:mall' && d.features.includes('mall'))
      ? d.features.filter(k => k !== key && !(key === 'method:mall' && k === 'mall')) : [...d.features, key];
    if (key.startsWith('method:') && !features.some(k => k.startsWith('method:'))) features.push('method:none');
    return { ...d, features };
  });

  const mode = draft?.features.includes('method:none') ? 'none' : draft?.features.some(k => k.startsWith('method:')) ? 'selected' : 'inherit';
  const setMode = (value: string) => setDraft(d => d ? { ...d, features: [
    ...d.features.filter(k => !k.startsWith('method:')),
    ...(value === 'none' ? ['method:none'] : value === 'selected' ? (catalog.data?.methods.map(m => m.featureKey) ?? []) : []),
  ] } : d);
  const reportError = (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败，请重试');

  const saveConfig = (tenantId: string) => {
    if (!draft || !canManage || !catalog.data || catalog.isError) return;
    const limit = Number(draft.userLimit);
    if (!Number.isInteger(limit) || limit < 1) { setError('用户上限必须为正整数'); return; }
    setFeedback(null); setError(null);
    updateConfiguration.mutate(
      { tenantId, data: { plan: draft.plan, userLimit: limit, enabledFeatures: draft.features } },
      {
        onSuccess: () => {
          setFeedback('租户套餐与功能开关已更新'); setEditId(null); refresh();
        },
        onError: reportError,
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
          {canManage && <button
            type="button"
            onClick={() => setShowOnboarding((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> {showOnboarding ? '收起开通' : '开通新企业'}
          </button>}
        </div>

        {canManage && showOnboarding && (
          <div className="mb-4">
            <EnterpriseOnboardingPanel embedded canCreateSupplier={canCreateSupplier} />
          </div>
        )}

        {feedback && (
          <div className="mb-4">
            <FeedbackNotice tone="success" message={feedback} />
          </div>
        )}
        {error && <div role="alert"><FeedbackNotice tone="error" message={error} /></div>}
        {canManage && catalog.isError && <FeedbackNotice tone="error" message="配置目录加载失败，请重试。" />}

        {tenants.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载租户…" />
        ) : tenants.isError ? <div role="alert"><FeedbackNotice tone="error" message="租户加载失败或权限已变更，请重试。" /></div> : filtered.length === 0 ? (
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
                            {canManage && <button
                              type="button"
                              onClick={() => (editId === t.id ? setEditId(null) : startEdit(t))}
                              className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              {editId === t.id ? '收起' : '编辑'}
                            </button>}
                            {canReadUsage && <button
                              type="button"
                              onClick={() => { setEditId(null); setUsageId((cur) => (cur === t.id ? null : t.id ?? null)); }}
                              className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                            >
                              用量
                            </button>}
                            {canManage && <button
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
                            </button>}
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

        {canReadUsage && usageId && focused?.id && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-black text-slate-900">「{focused.name}」用量与计费</p>
            <TenantUsagePanel tenantId={focused.id} />
          </div>
        )}

        {canManage && editId && draft && focused && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
            <p className="text-sm font-black text-blue-800">「{focused.name}」套餐与功能开关</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-black text-slate-500">套餐</label>
                <select
                  aria-label="套餐"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  value={draft.plan}
                  onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
                >
                  {catalog.data?.plans.map((p) => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500">用户上限</label>
                <input
                  aria-label="用户上限"
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
                {catalog.data?.features.map((f) => (
                  <label key={f.key} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={draft.features.includes(f.key)} disabled={f.configurable === false || updateConfiguration.isPending} onChange={() => toggleFeature(f.key)} />
                    {f.label}
                  </label>
                ))}
              </div>
              <p className="mt-4 text-[11px] font-black text-slate-500">采购方式(可自由组合)</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {[['inherit', '继承全部'], ['selected', '指定方式'], ['none', '全部关闭']].map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="radio" name="method-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />{label}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                {mode === 'selected' && catalog.data?.methods.map((f) => (
                  <label key={f.featureKey} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={draft.features.includes(f.featureKey) || (f.featureKey === 'method:mall' && draft.features.includes('mall'))} onChange={() => {
                      toggleFeature(f.featureKey);
                    }} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <PrimaryActionButton
              onClick={() => focused.id && saveConfig(focused.id)}
              busy={updateConfiguration.isPending}
              disabled={!catalog.data || catalog.isError || (mode === 'selected' && !draft.features.some(k => k.startsWith('method:')))}
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
