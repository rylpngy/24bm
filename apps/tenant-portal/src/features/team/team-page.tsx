import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, KeyRound, Pencil, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import {
  type BuyerUserResponse,
  useBuyerRoleList,
  useBuyerUserChangeStatus,
  useBuyerUserList,
  useBuyerUserResetPassword,
  useDepartmentList,
} from '@24bid/api-client';
import { ConfirmDialog, FeedbackNotice, Pagination, StatusPill, Tabs } from '@24bid/ui';
import { BuyerMemberEditorDialog } from '../shared/buyer-member-editor-dialog';
import { NotificationChannelPanel } from './notification-channel-panel';
import { ExternalIdentityPanel } from './external-identity-panel';
import { RolePermissionWorkbench } from './role-permission-workbench';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

interface Feedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

const PAGE_SIZE = 10;

function errorMessage(error: unknown, fallback: string) {
  const response = error as {
    response?: { data?: { message?: unknown; error?: { message?: unknown } } };
    message?: unknown;
  };
  const message = response.response?.data?.message ?? response.response?.data?.error?.message ?? response.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function TeamPage(props: { requireEmployeeNo?: boolean }) {
  const { can } = useBuyerPermissions();
  if (!can('buyer:role:manage')) return <FeedbackNotice tone="error" message="仅企业全权管理员可管理组织、成员与角色。" />;
  return <TeamManagementPage {...props} />;
}

function TeamManagementPage({ requireEmployeeNo = false }: { requireEmployeeNo?: boolean }) {
  const queryClient = useQueryClient();
  const usersQuery = useBuyerUserList();
  const departmentsQuery = useDepartmentList();
  const rolesQuery = useBuyerRoleList();
  const changeStatus = useBuyerUserChangeStatus();
  const resetPassword = useBuyerUserResetPassword();
  const [tab, setTab] = useState<'members' | 'roles' | 'notify' | 'identity'>('members');
  const [keyword, setKeyword] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [memberEditor, setMemberEditor] = useState<BuyerUserResponse | null | 'new'>(null);
  const [statusTarget, setStatusTarget] = useState<BuyerUserResponse | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<BuyerUserResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const users = usersQuery.data?.data || [];
  const departments = departmentsQuery.data?.data || [];
  const roles = rolesQuery.data?.data || [];

  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => {
      if (role.id) map.set(role.id, role.name || role.id);
    });
    return map;
  }, [roles]);
  const roleNames = (user: BuyerUserResponse) => {
    const roleIds = (user as BuyerUserResponse & { roleIds?: string[] }).roleIds;
    return (roleIds?.length ? roleIds : [user.roleId])
      .filter(Boolean)
      .map((roleId) => roleNameById.get(roleId!) || roleId)
      .join('、') || '未设置角色';
  };

  const departmentById = useMemo(() => {
    const map = new Map<string, { name: string; managerId?: string }>();
    departments.forEach((department) => {
      if (department.id) {
        map.set(department.id, {
          name: department.name || department.id,
          managerId: department.managerId,
        });
      }
    });
    return map;
  }, [departments]);

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return users.filter((user) => {
      const matchingDepartment = !departmentFilter || user.departmentId === departmentFilter;
      const matchingStatus = !statusFilter || user.status === statusFilter;
      const matchingKeyword =
        !normalized ||
        [user.name, user.employeeNo, user.mobile, user.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      return matchingDepartment && matchingStatus && matchingKeyword;
    });
  }, [departmentFilter, keyword, statusFilter, users]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCount = users.filter((user) => user.status === 'active').length;

  const resetFilters = () => {
    setKeyword('');
    setDepartmentFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) => /^\/api\/v1\/(buyer\/(users|departments|roles)|auth\/permissions)/.test(String(query.queryKey[0] || '')),
    });

  const confirmStatusChange = () => {
    if (!statusTarget?.id) return;
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    changeStatus.mutate(
      { userId: statusTarget.id, data: { status: nextStatus } },
      {
        onSuccess: () => {
          setFeedback({ tone: 'success', message: nextStatus === 'active' ? '成员已启用。' : '成员已停用。' });
          setStatusTarget(null);
          void refresh();
        },
        onError: (error) => {
          setStatusTarget(null);
          setFeedback({ tone: 'error', message: errorMessage(error, '成员状态更新失败，请稍后重试。') });
        },
      },
    );
  };

  const confirmPasswordReset = (newPassword: string) => {
    if (!passwordTarget?.id) return;
    resetPassword.mutate(
      { userId: passwordTarget.id, data: { newPassword } },
      {
        onSuccess: () => {
          setFeedback({ tone: 'success', message: '密码已重置，请通过安全渠道告知成员。' });
          setPasswordTarget(null);
        },
        onError: (error) => {
          setFeedback({ tone: 'error', message: errorMessage(error, '密码重置失败，请稍后重试。') });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Users size={19} />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-950">团队与权限</h1>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">成员账号、角色授权、数据范围和通知渠道统一维护</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600">{users.length} 名成员</span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700">{activeCount} 名在职</span>
          </div>
        </header>

        <div className="px-5 pt-4">
          <Tabs
            items={[
              { id: 'members', label: '团队成员', icon: Users, badge: users.length },
              { id: 'roles', label: '角色与权限', icon: ShieldCheck, badge: roles.length },
              { id: 'notify', label: '通知渠道', icon: Bell },
              { id: 'identity', label: '统一身份', icon: KeyRound },
            ]}
            value={tab}
            onChange={(value) => setTab(value as 'members' | 'roles' | 'notify' | 'identity')}
          />
        </div>

        <div className="p-5">
          {feedback && <div className="mb-4"><FeedbackNotice tone={feedback.tone} message={feedback.message} /></div>}

          {tab === 'members' && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900">成员台账</h2>
                  <p className="mt-0.5 text-xs font-semibold text-slate-400">账号资料、岗位、部门和主角色在同一处维护。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMemberEditor('new')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-black text-white transition hover:bg-blue-700"
                >
                  <UserPlus size={14} /> 新增成员
                </button>
              </header>

              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                <label className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => {
                      setKeyword(event.target.value);
                      setPage(1);
                    }}
                    placeholder="姓名、工号、手机或邮箱"
                    className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <select
                  value={departmentFilter}
                  onChange={(event) => {
                    setDepartmentFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">全部部门</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 min-w-28 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">全部状态</option>
                  <option value="active">在职</option>
                  <option value="inactive">已停用</option>
                </select>
                {(keyword || departmentFilter || statusFilter) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={14} /> 清除条件
                  </button>
                )}
                <span className="ml-auto text-xs font-bold text-slate-400">当前 {filteredUsers.length} 条</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1060px] table-fixed text-left">
                  <thead className="bg-slate-50/80">
                    <tr className="text-xs font-black text-slate-500">
                      <th className="w-[24%] px-5 py-3">成员</th>
                      <th className="w-[16%] px-4 py-3">所属部门</th>
                      <th className="w-[18%] px-4 py-3">岗位 / 角色</th>
                      <th className="w-[20%] px-4 py-3">联系方式</th>
                      <th className="w-[104px] px-4 py-3">状态</th>
                      <th className="sticky right-0 z-10 w-[232px] border-l border-slate-100 bg-slate-50/95 px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.isLoading ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-slate-400">正在加载成员…</td></tr>
                    ) : pagedUsers.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-slate-400">暂无符合条件的成员。</td></tr>
                    ) : (
                      pagedUsers.map((user) => {
                        const department = departmentById.get(user.departmentId || '');
                        const isManager = department?.managerId === user.id;
                        const isActive = user.status === 'active';
                        return (
                          <tr key={user.id} className="group border-t border-slate-100 align-middle transition hover:bg-slate-50/70">
                            <td className="px-5 py-3.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                                  {(user.name || '?').slice(0, 1)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-sm font-black text-slate-800">{user.name || '未命名成员'}</p>
                                    {isManager && <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">部门主管</span>}
                                  </div>
                                  <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-slate-400">{user.employeeNo || '未设置工号'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="truncate text-sm font-bold text-slate-700">{department?.name || '未分配部门'}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="truncate text-sm font-bold text-slate-700">{user.jobTitle || '未设置岗位'}</p>
                              <p className="mt-0.5 truncate text-xs font-semibold text-slate-400" title={roleNames(user)}>{roleNames(user)}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="truncate text-xs font-semibold text-slate-700">{user.mobile || '未登记手机号'}</p>
                              <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{user.email || '未登记邮箱'}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusPill label={isActive ? '在职' : '已停用'} />
                            </td>
                            <td className="sticky right-0 z-[5] w-[232px] border-l border-slate-100 bg-white px-4 py-3.5 transition group-hover:bg-slate-50">
                              <div className="flex min-w-[188px] items-center justify-end gap-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setMemberEditor(user)}
                                  className="inline-flex h-8 w-[68px] shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-black leading-none text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                                >
                                  <Pencil size={13} /> 编辑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPasswordTarget(user)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                  title="重置密码"
                                  aria-label="重置密码"
                                >
                                  <KeyRound size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatusTarget(user)}
                                  className={
                                    isActive
                                      ? 'inline-flex h-8 w-[64px] shrink-0 items-center justify-center rounded-md border border-red-200 bg-white px-2 text-xs font-black leading-none text-red-700 transition hover:border-red-300 hover:bg-red-50'
                                      : 'inline-flex h-8 w-[64px] shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-black leading-none text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100'
                                  }
                                >
                                  {isActive ? '停用' : '启用'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="border-t border-slate-100 px-5 py-3">
                <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredUsers.length} onPageChange={setPage} />
              </footer>
            </section>
          )}

          {tab === 'roles' && <RolePermissionWorkbench />}
          {tab === 'notify' && <NotificationChannelPanel />}
          {tab === 'identity' && <ExternalIdentityPanel />}
        </div>
      </section>

      <BuyerMemberEditorDialog
        open={memberEditor !== null}
        member={memberEditor === 'new' ? null : memberEditor}
        departments={departments}
        roles={roles}
        requireEmployeeNo={requireEmployeeNo}
        onClose={() => setMemberEditor(null)}
        onSaved={(_, mode) => {
          setMemberEditor(null);
          setFeedback({ tone: 'success', message: mode === 'create' ? '成员已创建。' : '成员资料已更新。' });
          void refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.status === 'active' ? '确认停用成员' : '确认启用成员'}
        message={
          statusTarget?.status === 'active'
            ? '停用后，该成员将无法继续登录和办理待办；如其为部门主管，系统会同时解除主管身份。'
            : '启用后，该成员将恢复登录和办理权限。'
        }
        tone={statusTarget?.status === 'active' ? 'danger' : 'primary'}
        confirmLabel={statusTarget?.status === 'active' ? '确认停用' : '确认启用'}
        busy={changeStatus.isPending}
        onCancel={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
      />

      <ConfirmDialog
        open={Boolean(passwordTarget)}
        title="重置成员密码"
        message={'请为“' + (passwordTarget?.name || '') + '”设置新密码。密码仅应通过安全渠道告知本人。'}
        confirmLabel="确认重置"
        busy={resetPassword.isPending}
        input={{ label: '新密码', placeholder: '至少 6 位', type: 'password', minLength: 6 }}
        onCancel={() => setPasswordTarget(null)}
        onConfirm={confirmPasswordReset}
      />
    </div>
  );
}
