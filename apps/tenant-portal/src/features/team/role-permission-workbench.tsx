import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Lock, Save, SlidersHorizontal, Users } from 'lucide-react';
import {
  type BuyerRoleResponse,
  type BuyerUserResponse,
  type PermissionPointResponse,
  useBuyerRoleList,
  useBuyerRolePermissionCatalog,
  useBuyerRoleUpdateDataScope,
  useBuyerRoleUpdatePermissions,
  useBuyerUserList,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

// 角色描述(后端角色无描述字段,按 id 给演示文案,缺省回落)。
const ROLE_DESC: Record<string, string> = {
  'role-buyer-owner': '拥有采购方全部权限,不可删除',
  'role-buyer-requester': '负责需求申请与询价比价',
  'role-buyer-finance': '负责付款登记与对账差异审批',
};

// 数据权限范围卡片。与后端 DataScope 保持一致:全部 / 本部门及下级 / 本部门 / 本人。
const SCOPES = [
  { value: 'all', title: '全部数据权限', desc: '可查看所有部门数据', enabled: true },
  { value: 'department_and_below', title: '本部门及下级', desc: '可查看所属部门及下级部门', enabled: true },
  { value: 'department', title: '仅本部门', desc: '仅可查看所属部门数据', enabled: true },
  { value: 'self', title: '仅本人', desc: '只能查看自己创建的数据', enabled: true },
];

function pointTag(point: string): string {
  if (point === 'buyer:*') return '全局';
  if (point.endsWith(':read')) return '菜单';
  return '按钮';
}

// 角色权限配置工作台:左=角色列表,中=功能权限树,右=数据权限范围 + 关联成员。
export function RolePermissionWorkbench() {
  const queryClient = useQueryClient();
  const roles = useBuyerRoleList();
  const catalog = useBuyerRolePermissionCatalog();
  const users = useBuyerUserList();
  const updatePerms = useBuyerRoleUpdatePermissions();
  const updateScope = useBuyerRoleUpdateDataScope();
  const [feedback, setFeedback] = useState<string | null>(null);

  const roleList = roles.data?.data ?? [];
  const userList = users.data?.data ?? [];
  const points = useMemo(
    () =>
      (catalog.data?.data ?? []).map((c: PermissionPointResponse) => ({
        point: c.point ?? '',
        label: c.label ?? '',
        group: c.group ?? '',
      })),
    [catalog.data],
  );
  const catalogPoints = useMemo(() => new Set(points.map((p) => p.point)), [points]);
  const groups = useMemo(() => [...new Set(points.map((p) => p.group))], [points]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roleList.find((r) => r.id === selectedId) ?? roleList[0];

  const [sel, setSel] = useState<string[]>([]);
  const [scope, setScope] = useState('all');

  // 切换角色时,把该角色的目录内权限 + 数据范围载入草稿。
  const initialPerms = (selected?.permissions ?? []).filter((p) => catalogPoints.has(p));
  const initialKey = `${selected?.id ?? ''}|${initialPerms.slice().sort().join(',')}|${selected?.dataScope ?? 'all'}`;
  useEffect(() => {
    if (!selected) return;
    setSel((selected.permissions ?? []).filter((p) => catalogPoints.has(p)));
    setScope(selected.dataScope ?? 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const dirty =
    sel.length !== initialPerms.length ||
    sel.some((p) => !initialPerms.includes(p)) ||
    scope !== (selected?.dataScope ?? 'all');

  const isAdmin = (r: BuyerRoleResponse) => (r.permissions ?? []).includes('buyer:*');
  const saving = updatePerms.isPending || updateScope.isPending;

  const toggle = (p: string) =>
    setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const toggleGroup = (g: string) => {
    const groupPoints = points.filter((p) => p.group === g).map((p) => p.point);
    const allOn = groupPoints.every((p) => sel.includes(p));
    setSel((s) =>
      allOn ? s.filter((p) => !groupPoints.includes(p)) : [...new Set([...s, ...groupPoints])],
    );
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/roles/.test(q.queryKey[0] as string),
    });

  const save = () => {
    if (!selected?.id) return;
    const roleId = selected.id;
    const done = () => {
      setFeedback(`角色「${selected.name}」配置已保存`);
      refresh();
    };
    updatePerms.mutate(
      { roleId, data: { permissions: sel } },
      {
        onSuccess: () => {
          if (scope !== (selected.dataScope ?? 'all')) {
            updateScope.mutate({ roleId, data: { dataScope: scope } }, { onSuccess: done });
          } else {
            done();
          }
        },
      },
    );
  };

  const reset = () => {
    if (!selected) return;
    setSel((selected.permissions ?? []).filter((p) => catalogPoints.has(p)));
    setScope(selected.dataScope ?? 'all');
  };

  const members = selected
    ? userList.filter((u: BuyerUserResponse) => u.roleId === selected.id)
    : [];

  if (roles.isLoading || catalog.isLoading) {
    return <FeedbackNotice tone="info" message="正在加载角色与权限目录…" />;
  }

  return (
    <div className="space-y-3">
      {feedback && <FeedbackNotice tone="success" message={feedback} />}
      <div className="grid gap-3 lg:grid-cols-[248px_1fr_300px]">
        {/* 左:角色列表 */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-sm font-black text-slate-700">
            <SlidersHorizontal size={15} className="text-blue-600" /> 角色列表
          </p>
          <div className="space-y-1.5">
            {roleList.map((r) => {
              const on = r.id === (selected?.id ?? '');
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id ?? null)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition',
                    on
                      ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-950/20'
                      : 'border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-black">{r.name}</span>
                    {isAdmin(r) && (
                      <Lock size={13} className={on ? 'text-blue-100' : 'text-slate-400'} />
                    )}
                  </div>
                  <p className={cn('mt-0.5 truncate text-[11px] font-bold', on ? 'text-blue-100' : 'text-slate-400')}>
                    {ROLE_DESC[r.id ?? ''] ?? '采购方自定义角色'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 中:功能权限配置 */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-lg font-black text-slate-950">
                {selected?.name ?? '—'}
                {selected && isAdmin(selected) && <Lock size={15} className="text-slate-400" />}
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-400">
                {ROLE_DESC[selected?.id ?? ''] ?? '采购方自定义角色'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={!dirty || saving}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                重置
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                <Save size={14} /> {saving ? '保存中' : '保存配置'}
              </button>
            </div>
          </div>

          <div className="p-4">
            <p className="mb-3 text-xs font-black text-slate-500">功能权限配置</p>
            {updatePerms.isError && (
              <p className="mb-3 text-xs font-bold text-red-600">保存失败:需「管理角色与权限」权限。</p>
            )}
            <div className="space-y-4">
              {groups.map((g) => {
                const groupPoints = points.filter((p) => p.group === g);
                const allOn = groupPoints.every((p) => sel.includes(p.point));
                const someOn = groupPoints.some((p) => sel.includes(p.point));
                return (
                  <div key={g}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g)}
                      className="flex items-center gap-2 text-sm font-black text-slate-800"
                    >
                      <CheckBox checked={allOn} partial={someOn && !allOn} />
                      {g}
                    </button>
                    <div className="mt-1.5 space-y-1">
                      {groupPoints.map((p) => {
                        const on = sel.includes(p.point);
                        return (
                          <button
                            key={p.point}
                            type="button"
                            onClick={() => toggle(p.point)}
                            title={p.point}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-bold transition',
                              on ? 'bg-blue-50/70 text-slate-800' : 'text-slate-500 hover:bg-slate-50',
                            )}
                          >
                            <CheckBox checked={on} />
                            <span className="ml-4">{p.label}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
                              {pointTag(p.point)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右:数据权限范围 + 关联成员 */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-black text-slate-700">
              <Database size={15} className="text-blue-600" /> 数据权限范围
            </p>
            <div className="space-y-2">
              {SCOPES.map((s) => {
                const on = scope === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={!s.enabled}
                    onClick={() => s.enabled && setScope(s.value)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition',
                      !s.enabled
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50/60 opacity-60'
                        : on
                          ? 'border-blue-500 bg-blue-50/60'
                          : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        on ? 'border-blue-600' : 'border-slate-300',
                      )}
                    >
                      {on && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-black text-slate-800">
                        {s.title}
                        {!s.enabled && (
                          <span className="rounded bg-slate-100 px-1 text-[10px] font-black text-slate-400">
                            暂未开放
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold text-slate-400">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-black text-slate-700">
              <Users size={15} className="text-blue-600" /> 关联成员 ({members.length})
            </p>
            {members.length === 0 ? (
              <p className="text-[11px] font-bold text-slate-400">暂无成员使用该角色。</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                      {(m.name ?? '?').slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-700">{m.name}</p>
                      <p className="truncate text-[11px] font-bold text-slate-400">{m.departmentId ?? '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckBox({ checked, partial }: { checked: boolean; partial?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white',
        checked || partial ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white',
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M2.5 6.5 5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {partial && !checked && <span className="h-0.5 w-2 rounded bg-white" />}
    </span>
  );
}
