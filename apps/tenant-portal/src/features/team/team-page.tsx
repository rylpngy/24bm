import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Users } from 'lucide-react';
import {
  useBuyerRoleList,
  useBuyerUserChangeRole,
  useBuyerUserChangeStatus,
  useBuyerUserList,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, Panel, StatusPill } from '@24bid/ui';
import { NotificationChannelPanel } from './notification-channel-panel';

// 团队与权限:角色权限矩阵 + 团队成员(改角色 / 启停)。
export function TeamPage() {
  const queryClient = useQueryClient();
  const roles = useBuyerRoleList();
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
      <Panel title="角色权限矩阵" icon={ShieldCheck} subtitle="角色 · 权限范围">
        {roles.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载角色…" />
        ) : (
          <div className="space-y-3">
            {roleList.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-black text-slate-950">{r.name}</p>
                <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{r.id}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(r.permissions ?? []).map((p) => (
                    <span key={p} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-600">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
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
