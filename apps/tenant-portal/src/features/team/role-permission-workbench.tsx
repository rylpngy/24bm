import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Database, LockKeyhole, Minus, Plus, Save, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import {
  type BuyerRoleResponse,
  type PermissionPointResponse,
  useBuyerRoleCreate,
  useBuyerRoleDelete,
  useBuyerRoleList,
  useBuyerRolePermissionCatalog,
  useBuyerRoleUpdate,
  useBuyerUserList,
} from '@24bid/api-client';
import { ConfirmDialog, FeedbackNotice, cn } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

interface Feedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

const ROLE_DESCRIPTION: Record<string, string> = {
  'role-buyer-owner': '系统保护角色，保留全部采购方管理权限。',
  'role-buyer-requester': '面向需求申请、询比项目和日常采购协同人员。',
  'role-buyer-finance': '面向发票、付款和对账相关人员。',
};

const DATA_SCOPES = [
  { id: 'all', label: '全部数据', description: '可查看当前企业全部部门的数据。' },
  { id: 'department_and_below', label: '本部门及下级', description: '可查看本人部门和下级部门的数据。' },
  { id: 'department', label: '仅本部门', description: '仅可查看本人所属部门的数据。' },
  { id: 'self', label: '仅本人', description: '仅可查看本人创建或负责的数据。' },
];

function errorMessage(error: unknown, fallback: string) {
  const response = error as {
    response?: { data?: { message?: unknown; error?: { message?: unknown } } };
    message?: unknown;
  };
  const message = response.response?.data?.message ?? response.response?.data?.error?.message ?? response.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function isProtectedRole(role: BuyerRoleResponse | undefined) {
  return Boolean((role as (BuyerRoleResponse & { protectedRole?: boolean }) | undefined)?.protectedRole)
    || role?.id === 'role-buyer-owner'
    || Boolean(role?.tenantId && role.id === `role-${role.tenantId}-buyer-owner`);
}

function isBuiltInRole(role: BuyerRoleResponse | undefined) {
  return Boolean(isProtectedRole(role) || role?.builtIn || role?.id?.startsWith('role-buyer-'));
}

function permissionKind(point: string) {
  if (point === 'buyer:*') return '全局';
  if (point.endsWith(':read')) return '查看';
  return '操作';
}

export function RolePermissionWorkbench() {
  const { can } = useBuyerPermissions();
  if (!can('buyer:role:manage')) return <FeedbackNotice tone="error" message="仅企业全权管理员可配置角色权限。" />;
  return <RoleConfiguration />;
}

function RoleConfiguration() {
  const queryClient = useQueryClient();
  const rolesQuery = useBuyerRoleList();
  const catalogQuery = useBuyerRolePermissionCatalog();
  const usersQuery = useBuyerUserList();
  const createRole = useBuyerRoleCreate();
  const updateRole = useBuyerRoleUpdate();
  const deleteRole = useBuyerRoleDelete();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [draftScope, setDraftScope] = useState('department');
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BuyerRoleResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const roles = rolesQuery.data?.data || [];
  const users = usersQuery.data?.data || [];
  const points = useMemo(
    () =>
      (catalogQuery.data?.data || [])
        .map((point: PermissionPointResponse) => ({
          id: point.point || '',
          label: point.label || '',
          group: point.group || '其他',
        }))
        .filter((point) => point.id),
    [catalogQuery.data],
  );
  const validPoints = useMemo(() => new Set(points.map((point) => point.id)), [points]);
  const groups = useMemo(() => [...new Set(points.map((point) => point.group))], [points]);
  const selected = roles.find((role) => role.id === selectedId) || roles[0];
  const initialPermissions = useMemo(
    () => (selected?.permissions || []).filter((permission) => validPoints.has(permission)),
    [selected?.permissions, validPoints],
  );
  const selectedKey = [
    selected?.id || '',
    selected?.name || '',
    selected?.dataScope || '',
    initialPermissions.slice().sort().join(','),
  ].join('|');
  const protectedRole = isProtectedRole(selected);
  const memberList = selected?.id ? users.filter((user) => {
    const roleIds = (user as typeof user & { roleIds?: string[] }).roleIds;
    return roleIds?.length ? roleIds.includes(selected.id!) : user.roleId === selected.id;
  }) : [];
  const dirty =
    draftName.trim() !== (selected?.name || '') ||
    draftScope !== (selected?.dataScope || 'department') ||
    draftPermissions.length !== initialPermissions.length ||
    draftPermissions.some((permission) => !initialPermissions.includes(permission));

  useEffect(() => {
    if (!selected) return;
    setDraftName(selected.name || '');
    setDraftPermissions(initialPermissions);
    setDraftScope(selected.dataScope || 'department');
  }, [initialPermissions, selected, selectedKey]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) => /^\/api\/v1\/(buyer\/(roles|users)|auth\/permissions)/.test(String(query.queryKey[0] || '')),
    });

  const togglePermission = (permission: string) => {
    setDraftPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  const toggleGroup = (group: string) => {
    const groupPermissions = points.filter((point) => point.group === group).map((point) => point.id);
    const allSelected = groupPermissions.every((permission) => draftPermissions.includes(permission));
    setDraftPermissions((current) =>
      allSelected
        ? current.filter((permission) => !groupPermissions.includes(permission))
        : [...new Set([...current, ...groupPermissions])],
    );
  };

  const saveRole = () => {
    if (!selected?.id || !draftName.trim() || protectedRole) return;
    updateRole.mutate(
      {
        roleId: selected.id,
        data: {
          name: draftName.trim(),
          permissions: draftPermissions,
          dataScope: draftScope,
        },
      },
      {
        onSuccess: () => {
          setFeedback({ tone: 'success', message: '角色配置已保存。' });
          void refresh();
        },
        onError: (error) => setFeedback({ tone: 'error', message: errorMessage(error, '角色配置保存失败，请稍后重试。') }),
      },
    );
  };

  const createNewRole = () => {
    if (!newRoleName.trim()) return;
    createRole.mutate(
      { data: { name: newRoleName.trim(), permissions: [], dataScope: 'department' } },
      {
        onSuccess: (response) => {
          setNewRoleOpen(false);
          setNewRoleName('');
          setSelectedId(response.data?.id || null);
          setFeedback({ tone: 'success', message: '自定义角色已创建，请继续配置权限和数据范围。' });
          void refresh();
        },
        onError: (error) => setFeedback({ tone: 'error', message: errorMessage(error, '创建角色失败，请检查名称后重试。') }),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget?.id) return;
    deleteRole.mutate(
      { roleId: deleteTarget.id },
      {
        onSuccess: () => {
          setSelectedId(null);
          setDeleteTarget(null);
          setFeedback({ tone: 'success', message: '自定义角色已删除。' });
          void refresh();
        },
        onError: (error) => {
          setDeleteTarget(null);
          setFeedback({ tone: 'error', message: errorMessage(error, '删除失败：请先为关联成员分配其他角色。') });
        },
      },
    );
  };

  if (rolesQuery.isLoading || catalogQuery.isLoading) {
    return <FeedbackNotice tone="info" message="正在加载角色与权限目录…" />;
  }

  return (
    <div className="space-y-4">
      {feedback && <FeedbackNotice tone={feedback.tone} message={feedback.message} />}

      <div className="grid gap-4 xl:grid-cols-[252px_minmax(0,1fr)_288px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-black text-slate-900">角色列表</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">内置角色与企业自定义角色</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewRoleName('');
                setNewRoleOpen(true);
              }}
              title="新增自定义角色"
              aria-label="新增自定义角色"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Plus size={15} />
            </button>
          </header>
          <div className="max-h-[620px] space-y-1.5 overflow-y-auto p-3">
            {roles.map((role) => {
              const active = role.id === selected?.id;
              const memberCount = users.filter((user) => {
                const roleIds = (user as typeof user & { roleIds?: string[] }).roleIds;
                return roleIds?.length ? roleIds.includes(role.id!) : user.roleId === role.id;
              }).length;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id || null)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition',
                    active
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-black">{role.name || '未命名角色'}</span>
                    {isBuiltInRole(role) && <LockKeyhole size={13} className={active ? 'text-blue-100' : 'text-slate-400'} />}
                  </div>
                  <div className={cn('mt-1 flex items-center justify-between gap-2 text-[11px] font-bold', active ? 'text-blue-100' : 'text-slate-400')}>
                    <span className="truncate">{ROLE_DESCRIPTION[role.id || ''] || '企业自定义角色'}</span>
                    <span className="shrink-0">{memberCount} 人</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {!selected ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <ShieldCheck size={28} className="text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-600">请选择或新建一个角色</p>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-black text-slate-950">{selected.name}</h2>
                    {isBuiltInRole(selected) && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-500">系统角色</span>
                    )}
                    {protectedRole && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">受保护</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {ROLE_DESCRIPTION[selected.id || ''] || '按企业职责配置功能权限和数据可见范围。'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveRole}
                  disabled={protectedRole || !dirty || updateRole.isPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                >
                  <Save size={14} /> {updateRole.isPending ? '保存中' : '保存配置'}
                </button>
              </header>

              <div className="space-y-5 p-5">
                {protectedRole && (
                  <FeedbackNotice tone="info" message="采购管理员为系统保护角色，始终保留全部权限和全部数据范围，不能修改。" />
                )}
                <label className="block max-w-md">
                  <span className="mb-1.5 block text-xs font-black text-slate-600">角色名称</span>
                  <input
                    value={draftName}
                    disabled={protectedRole}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </label>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">功能权限</h3>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">按业务域授予菜单查看和业务操作权限。</p>
                    </div>
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{draftPermissions.length} 项</span>
                  </div>
                  {(draftPermissions.includes('buyer:role:manage') || draftPermissions.includes('buyer:*')) && (
                    <div className="mb-3"><FeedbackNotice tone="info" message="企业全权管理员可管理组织、成员、角色、数据范围与配置，并可授予全部权限。" /></div>
                  )}
                  <div className="space-y-4">
                    {groups.map((group) => {
                      const groupPoints = points.filter((point) => point.group === group);
                      const enabledCount = groupPoints.filter((point) => draftPermissions.includes(point.id)).length;
                      const allEnabled = enabledCount === groupPoints.length && groupPoints.length > 0;
                      const partial = enabledCount > 0 && !allEnabled;
                      return (
                        <div key={group} className="rounded-lg border border-slate-200">
                          <button
                            type="button"
                            disabled={protectedRole}
                            onClick={() => toggleGroup(group)}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-3.5 py-3 text-left disabled:cursor-not-allowed"
                          >
                            <span className="flex items-center gap-2 text-sm font-black text-slate-700">
                              <PermissionToggle checked={allEnabled} partial={partial} />
                              {group}
                            </span>
                            <span className="text-xs font-bold text-slate-400">{enabledCount} / {groupPoints.length}</span>
                          </button>
                          <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
                            {groupPoints.map((point) => {
                              const enabled = draftPermissions.includes(point.id);
                              return (
                                <button
                                  key={point.id}
                                  type="button"
                                  disabled={protectedRole}
                                  onClick={() => togglePermission(point.id)}
                                  className={cn(
                                    'flex min-w-0 items-center gap-2 bg-white px-3.5 py-3 text-left transition disabled:cursor-not-allowed',
                                    enabled ? 'text-slate-800' : 'text-slate-500 hover:bg-slate-50',
                                  )}
                                  title={point.id}
                                >
                                  <PermissionToggle checked={enabled} />
                                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{point.label}</span>
                                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
                                    {permissionKind(point.id)}
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
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Database size={15} /></span>
              <div>
                <h2 className="text-sm font-black text-slate-800">数据范围</h2>
                <p className="text-[11px] font-semibold text-slate-400">控制角色可见业务数据</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {DATA_SCOPES.map((scope) => {
                const active = draftScope === scope.id;
                return (
                  <button
                    key={scope.id}
                    type="button"
                    disabled={!selected || protectedRole}
                    onClick={() => setDraftScope(scope.id)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
                      active ? 'border-blue-500 bg-blue-50/70' : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', active ? 'border-blue-600' : 'border-slate-300')}>
                      {active && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-800">{scope.label}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-400">{scope.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Users size={15} /></span>
                <div>
                  <h2 className="text-sm font-black text-slate-800">关联成员</h2>
                  <p className="text-[11px] font-semibold text-slate-400">{memberList.length} 名成员使用此角色</p>
                </div>
              </div>
            </div>
            {memberList.length === 0 ? (
              <p className="mt-4 text-xs font-semibold text-slate-400">暂无成员使用此角色。</p>
            ) : (
              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                {memberList.map((member) => (
                  <div key={member.id} className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                      {(member.name || '?').slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-700">{member.name || '未命名成员'}</p>
                      <p className="truncate text-[11px] font-semibold text-slate-400">{member.jobTitle || '未设置岗位'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selected && !isBuiltInRole(selected) && (
            <button
              type="button"
              onClick={() => setDeleteTarget(selected)}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={14} /> 删除自定义角色
            </button>
          )}
        </aside>
      </div>

      <RoleCreateDialog
        open={newRoleOpen}
        name={newRoleName}
        busy={createRole.isPending}
        onNameChange={setNewRoleName}
        onCancel={() => setNewRoleOpen(false)}
        onConfirm={createNewRole}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="确认删除自定义角色"
        message={'删除“' + (deleteTarget?.name || '') + '”后不可恢复。若仍有关联成员，系统会阻止删除。'}
        tone="danger"
        confirmLabel="确认删除"
        busy={deleteRole.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function PermissionToggle({ checked, partial = false }: { checked: boolean; partial?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        checked || partial ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent',
      )}
    >
      {checked ? <Check size={12} strokeWidth={3} /> : partial ? <Minus size={12} strokeWidth={3} /> : null}
    </span>
  );
}

function RoleCreateDialog({
  open,
  name,
  busy,
  onNameChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onClick={busy ? undefined : onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="新增自定义角色"
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">新增自定义角色</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">创建后可继续配置功能权限和数据范围。</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="关闭"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>
        <div className="px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-slate-600">角色名称 <span className="text-red-500">*</span></span>
            <input
              autoFocus
              value={name}
              maxLength={50}
              placeholder="如：采购平台主管"
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim()) onConfirm();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={onConfirm}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {busy ? '创建中…' : '创建角色'}
          </button>
        </footer>
      </section>
    </div>
  );
}
