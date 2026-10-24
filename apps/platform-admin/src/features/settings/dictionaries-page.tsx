import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListTree, Plus, Settings2 } from 'lucide-react';
import {
  usePlatformDictionaryCreate,
  usePlatformDictionaryEntries,
  usePlatformDictionaryTypes,
  usePlatformDictionaryUpdate,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  MetricCard,
  MetricGrid,
  Panel,
  PrimaryActionButton,
  SectionCard,
  cn,
} from '@24bid/ui';

// 常见字典类型的中文说明(仅展示用;未登记的类型直接显示原始 key)。
const TYPE_LABELS: Record<string, string> = {
  payment_status: '付款状态',
  announcement_audience: '公告受众',
  supplier_user_status: '供应商用户状态',
  attachment_visibility: '附件可见范围',
};

const inputCls =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 平台运营配置:全局字典维护(条目为业务下拉的数据源,停用而非删除以保引用安全)。
export function DictionariesPage({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient();
  const types = usePlatformDictionaryTypes();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ code: '', label: '', sortOrder: '' });
  const [editing, setEditing] = useState<Record<string, { label: string; sortOrder: string }>>({});

  const typeList = types.isError ? [] : types.data?.data ?? [];
  const currentType = activeType ?? typeList[0]?.type ?? null;
  const entries = usePlatformDictionaryEntries(currentType ?? '', { query: { enabled: !!currentType } });
  const create = usePlatformDictionaryCreate();
  const update = usePlatformDictionaryUpdate();
  const entryList = entries.isError ? [] : entries.data?.data ?? [];
  const fixedTypes = ['payment_status', 'announcement_audience', 'supplier_user_status', 'attachment_visibility'];
  const extensible = !!currentType && !fixedTypes.includes(currentType);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/platform/dictionaries'),
    });
  const reportError = (e: unknown) =>
    setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试');

  const doCreate = () => {
    if (!currentType || !canManage || !extensible) return;
    setError(null); setFeedback(null);
    create.mutate(
      { data: { type: currentType, code: draft.code.trim(), label: draft.label.trim(), sortOrder: draft.sortOrder ? Number(draft.sortOrder) : 0 } },
      {
        onSuccess: () => {
          setFeedback(`已新增字典条目「${draft.label.trim()}」。`);
          setDraft({ code: '', label: '', sortOrder: '' });
          setCreating(false);
          refresh();
        },
        onError: reportError,
      },
    );
  };

  const doUpdate = (code: string, label: string, sortOrder: number, status: string) => {
    if (!currentType || !canManage) return;
    setError(null); setFeedback(null);
    update.mutate(
      { type: currentType, code, data: { type: currentType, code, label, sortOrder, status } },
      {
        onSuccess: () => {
          setEditing(drafts => { const next = { ...drafts }; delete next[code]; return next; });
          setFeedback(`条目「${label}」已更新。`); refresh();
        },
        onError: reportError,
      },
    );
  };

  const totalEntries = typeList.reduce((s, t) => s + (t.entryCount ?? 0), 0);
  const totalActive = typeList.reduce((s, t) => s + (t.activeCount ?? 0), 0);

  return (
    <Panel title="运营配置" icon={Settings2} subtitle="全局字典维护 · 业务下拉数据源(停用不删除,保引用安全)">
      <MetricGrid>
        <MetricCard icon={ListTree} label="字典类型" value={String(typeList.length)} hint="业务枚举分类" tone="blue" />
        <MetricCard icon={Settings2} label="条目总数" value={String(totalEntries)} hint={`${totalActive} 条启用中`} tone="emerald" />
        <MetricCard icon={Settings2} label="已停用" value={String(totalEntries - totalActive)} hint="保留历史引用" tone="amber" />
      </MetricGrid>

      {feedback && <div className="mb-3"><FeedbackNotice tone="success" message={feedback} /></div>}
      {error && <div role="alert" className="mb-3"><FeedbackNotice tone="error" message={error} /></div>}

      {types.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载字典类型…" />
      ) : types.isError ? <div role="alert"><FeedbackNotice tone="error" message="字典加载失败或权限已变更，请重试。" /></div> : typeList.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无字典类型。" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[16rem_1fr]">
          {/* 类型列表 */}
          <SectionCard icon={ListTree} title="字典类型">
            <div className="space-y-1.5">
              {typeList.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  disabled={update.isPending || create.isPending}
                  onClick={() => { setActiveType(t.type ?? null); setCreating(false); setEditing({}); }}
                  className={cn('w-full rounded-lg border px-3 py-2.5 text-left transition',
                    currentType === t.type
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50')}
                >
                  <p className={cn('text-sm font-black', currentType === t.type ? 'text-blue-800' : 'text-slate-900')}>
                    {TYPE_LABELS[t.type ?? ''] ?? t.type}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">
                    {t.type} · {t.activeCount}/{t.entryCount} 启用
                  </p>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* 条目维护 */}
          <SectionCard
            icon={Settings2}
            title={`${TYPE_LABELS[currentType ?? ''] ?? currentType ?? '条目'} · 条目维护`}
            extra={
              canManage && extensible && !creating && (
                <button type="button" disabled={update.isPending || create.isPending} onClick={() => setCreating(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800">
                  <Plus size={13} /> 新增条目
                </button>
              )
            }
          >
            {canManage && creating && (
              <fieldset disabled={create.isPending} className="mb-4 min-w-0 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <p className="text-xs font-black text-blue-900">新增条目(编码创建后不可修改)</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
                  <input className={inputCls} placeholder="编码(小写字母/数字/_/-)" aria-label="条目编码"
                    value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                  <input className={inputCls} placeholder="显示名称" aria-label="显示名称"
                    value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                  <input className={inputCls} type="number" placeholder="排序" aria-label="排序"
                    value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
                  <div className="flex gap-2">
                    <PrimaryActionButton size="sm" busy={create.isPending} pendingLabel="保存中"
                      disabled={!draft.code.trim() || !draft.label.trim()} onClick={doCreate}>
                      保存
                    </PrimaryActionButton>
                    <button type="button" onClick={() => { setCreating(false); setDraft({ code: '', label: '', sortOrder: '' }); }}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                      取消
                    </button>
                  </div>
                </div>
              </fieldset>
            )}

            {entries.isLoading ? (
              <FeedbackNotice tone="info" message="正在加载条目…" />
            ) : entries.isError ? <FeedbackNotice tone="error" message="字典条目加载失败，请重试。" /> : entryList.length === 0 ? (
              <FeedbackNotice tone="info" message="该类型下暂无条目,点击「新增条目」添加。" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                    <tr>
                      <th className="px-3 py-2">编码</th>
                      <th className="px-3 py-2">显示名称</th>
                      <th className="px-3 py-2 w-20 text-right">排序</th>
                      <th className="px-3 py-2">状态</th>
                      {canManage && <th className="px-3 py-2 text-right">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entryList.map((e) => {
                      const key = e.code ?? '';
                      const d = editing[key] ?? { label: e.label ?? '', sortOrder: String(e.sortOrder ?? 0) };
                      const dirty = !!editing[key] && (d.label !== e.label || Number(d.sortOrder) !== e.sortOrder);
                      const active = e.status === 'active';
                      return (
                        <tr key={key} className="font-bold text-slate-700">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{e.code}</td>
                          <td className="px-3 py-2">
                            {canManage ? <input disabled={update.isPending || create.isPending} className={cn(inputCls, 'h-8')} aria-label={`名称-${e.code}`} value={d.label}
                              onChange={(ev) => setEditing({ ...editing, [key]: { ...d, label: ev.target.value } })} /> : e.label}
                          </td>
                          <td className="px-3 py-2">
                            {canManage ? <input disabled={update.isPending || create.isPending} className={cn(inputCls, 'h-8 text-right')} type="number" aria-label={`排序-${e.code}`} value={d.sortOrder}
                              onChange={(ev) => setEditing({ ...editing, [key]: { ...d, sortOrder: ev.target.value } })} /> : e.sortOrder}
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                              active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                              {active ? '启用' : '停用'}
                            </span>
                          </td>
                          {canManage && <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              {dirty && (
                                <button type="button" disabled={update.isPending || !d.label.trim() || !Number.isInteger(Number(d.sortOrder))}
                                  onClick={() => doUpdate(key, d.label.trim(), Number(d.sortOrder) || 0, e.status ?? 'active')}
                                  className="inline-flex h-7 items-center rounded-md bg-blue-600 px-2.5 text-[11px] font-black text-white hover:bg-blue-700 disabled:opacity-50">
                                  保存
                                </button>
                              )}
                              <button type="button" disabled={update.isPending || dirty}
                                onClick={() => doUpdate(key, e.label ?? '', e.sortOrder ?? 0, active ? 'inactive' : 'active')}
                                className={cn('inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-black',
                                  active ? 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                                    : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50')}>
                                {active ? '停用' : '启用'}
                              </button>
                            </div>
                          </td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] font-bold text-slate-400">
              编码为业务程序识别键,创建后不可修改;不再使用的条目请「停用」而非删除,以免历史单据引用失效。
            </p>
          </SectionCard>
        </div>
      )}
    </Panel>
  );
}
