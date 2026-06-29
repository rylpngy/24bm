import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Users } from 'lucide-react';
import {
  type BuyerRoleResponse,
  type PermissionPointResponse,
  useBuyerRoleList,
  useBuyerRolePermissionCatalog,
  useBuyerRoleUpdateDataScope,
  useBuyerRoleUpdatePermissions,
  useBuyerUserChangeRole,
  useBuyerUserChangeStatus,
  useBuyerUserList,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, Panel, StatusPill, cn } from '@24bid/ui';
import { NotificationChannelPanel } from './notification-channel-panel';

// 团队与权限:角色权限矩阵 + 团队成员(改角色 / 启停)。
export function TeamPage() {
  const queryClient = useQueryClient();
  const roles = useBuyerRoleList();
  const catalog = useBuyerRolePermissionCatalog();
  const users = useBuyerUserList();
  const changeRole = useBuyerUserChangeRole();
  const changeStatus = useBuyerUserChangeStatus();
  const [feedback, setFeedback] = useState<string | null>(null);

  const roleList = roles.data?.data ?? [];
  const userList = users.data?.data ?? [];
  const roleName = useMemo(() => {
    const m: Record<string, string> = {};
    roleList.forEach((r) => { if (r.id) m[r.id] = r.name ?? r.id; });
    return m;
  }, [roleList]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(users|roles)/.test(q.queryKey[0] as string),
    });

  const onRole = (userId: string, roleId: string) =>
    changeRole.mutate(
      { userId, data: { roleId } },
      { onSuccess: () => { setFeedback('成员角色已更新'); refresh(); } },
    );

  const onStatus = (userId: string, active: boolean) =>
    changeStatus.mutate(
      { userId, data: { status: active ? 'disabled' : 'active' } },
      { onSuccess: () => { setFeedback(`成员已${active ? '停用' : '启用'}`); refresh(); } },
    );

  return (
    <div className="space-y-5">
      <Panel title="角色权限矩阵" icon={ShieldCheck} subtitle="勾选权限点 · 保存即生效(需管理角色权限)">
        {roles.isLoading || catalog.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载角色与权限目录…" />
        ) : (
          <div className="space-y-3">
            {roleList.map((r) => (
              <RolePermissionCard
                key={r.id}
                role={r}
                catalog={catalog.data?.data ?? []}
                onSaved={() => {
                  setFeedback(`角色「${r.name}」权限已更新`);
                  refresh();
                }}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="团队成员" icon={Users} subtitle="角色分配 · 启停">
        <div className="mb-4">
          <CountTag>共 {userList.length} 名成员</CountTag>
        </div>
        {feedback && (
          <div className="mb-3">
            <FeedbackNotice tone="success" message={feedback} />
          </div>
        )}
        {users.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载成员…" />
        ) : (
          <div className="space-y-3">
            {userList.map((u) => {
              const active = u.status === 'active';
              const busy =
                (changeRole.isPending && changeRole.variables?.userId === u.id) ||
                (changeStatus.isPending && changeStatus.variables?.userId === u.id);
              return (
                <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{u.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {u.email} · {u.departmentId} · 现角色 {roleName[u.roleId ?? ''] ?? u.roleId ?? '—'}
                      </p>
                    </div>
                    <StatusPill label={active ? '启用' : '停用'} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-300"
                      value={u.roleId ?? ''}
                      disabled={busy}
                      onChange={(e) => u.id && onRole(u.id, e.target.value)}
                    >
                      {roleList.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => u.id && onStatus(u.id, active)} disabled={busy}
                      className={
                        active
                          ? 'inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50'
                          : 'inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300'
                      }>
                      {active ? '停用' : '启用'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <NotificationChannelPanel />
    </div>
  );
}

// 单个角色的权限编辑卡:目录内权限点复选(分组)+ 仅在改动后出现「保存权限」。
function RolePermissionCard({
  role,
  catalog,
  onSaved,
}: {
  role: BuyerRoleResponse;
  catalog: PermissionPointResponse[];
  onSaved: () => void;
}) {
  const update = useBuyerRoleUpdatePermissions();
  const updateScope = useBuyerRoleUpdateDataScope();
  const scope = role.dataScope ?? 'all';
  const setScope = (dataScope: string) => {
    if (!role.id || dataScope === scope) return;
    updateScope.mutate({ roleId: role.id, data: { dataScope } }, { onSuccess: onSaved });
  };
  const points = catalog.map((c) => ({
    point: c.point ?? '',
    label: c.label ?? '',
    group: c.group ?? '',
  }));
  const catalogPoints = points.map((c) => c.point);
  const initial = (role.permissions ?? []).filter((p) => catalogPoints.includes(p));
  const [sel, setSel] = useState<string[]>(initial);
  const isAdmin = sel.includes('buyer:*');
  const groups = [...new Set(points.map((c) => c.group))];
  const dirty = sel.length !== initial.length || sel.some((p) => !initial.includes(p));

  const toggle = (p: string) =>
    setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const save = () =>
    role.id && update.mutate({ roleId: role.id, data: { permissions: sel } }, { onSuccess: onSaved });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-slate-950">
            {role.name}
            {isAdmin && (
              <span className="ml-2 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">
                管理员 · 全部权限
              </span>
            )}
          </p>
          <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{role.id}</p>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className="inline-flex h-8 shrink-0 items-center rounded-md bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-400"
          >
            {update.isPending ? '保存中' : '保存权限'}
          </button>
        )}
      </div>
      {update.isError && (
        <p className="mt-2 text-xs font-bold text-red-600">保存失败:需「管理角色与权限」权限。</p>
      )}
      <div className="mt-3 space-y-2">
        {groups.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="w-12 shrink-0 text-[11px] font-black text-slate-400">{g}</span>
            {points
              .filter((c) => c.group === g)
              .map((c) => {
                const on = sel.includes(c.point);
                return (
                  <button
                    key={c.point}
                    type="button"
                    onClick={() => toggle(c.point)}
                    title={c.point}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-black transition',
                      on
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3 w-3 rounded-sm border',
                        on ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300',
                      )}
                    />
                    {c.label}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <span className="w-12 shrink-0 text-[11px] font-black text-slate-400">数据范围</span>
        {[
          { value: 'all', label: '全部数据' },
          { value: 'department', label: '仅本部门' },
        ].map((opt) => {
          const on = scope === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScope(opt.value)}
              disabled={updateScope.isPending}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-black transition disabled:opacity-50',
                on
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3 w-3 rounded-full border',
                  on ? 'border-blue-500 bg-blue-500' : 'border-slate-300',
                )}
              />
              {opt.label}
            </button>
          );
        })}
        <span className="ml-1 text-[11px] font-bold text-slate-400">
          仅本部门：成员只可见本部门的采购需求
        </span>
      </div>
      {updateScope.isError && (
        <p className="mt-2 text-xs font-bold text-red-600">数据范围保存失败:需「管理角色与权限」权限。</p>
      )}
    </div>
  );
}
