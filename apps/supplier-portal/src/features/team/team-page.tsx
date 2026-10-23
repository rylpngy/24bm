import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Pencil, Plus, Users } from 'lucide-react';
import {
  useSupplierUserChangeStatus,
  useSupplierUserCreate,
  useSupplierUserList,
  useSupplierUserResetPassword,
  useSupplierUserChangeRole,
  useSupplierUserUpdateProfile,
  type SupplierUserResponse,
} from '@24bid/api-client';
import {
  ConfirmDialog,
  FilterTabs,
  FormErrorSummary,
  FeedbackNotice,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';

const PAGE_SIZE = 10;
const MEMBER_ROLE = 'role-system-supplier-member';
const OWNER_ROLE = 'role-system-supplier-owner';
const roleLabel = (id?: string) => id === OWNER_ROLE ? '供应商管理员' : id === MEMBER_ROLE ? '业务成员' : '原有角色';
const statusLabel = (status?: string) => status === 'active' ? '启用' : status === 'inactive' ? '停用' : status ?? '未知';

const inputCls =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 新增成员独立页:姓名/联系方式/初始密码,创建后可登录供应商门户。
function MemberCreatePage({ member, onBack, onSaved }: { member?: SupplierUserResponse; onBack: () => void; onSaved: (msg: string) => void }) {
  const create = useSupplierUserCreate();
  const update = useSupplierUserUpdateProfile();
  const [form, setForm] = useState({ name: member?.name ?? '', mobile: member?.mobile ?? '', email: member?.email ?? '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const submit = () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('请填写「姓名」');
    if (!member && form.password.trim().length < 6) missing.push('「初始密码」至少 6 位');
    if (!form.mobile.trim() && !form.email.trim()) missing.push('手机号或邮箱至少填写一项，用于登录');
    if (form.mobile.trim() && !/^\+?[0-9]{7,20}$/.test(form.mobile.trim())) missing.push('手机号需为7至20位数字，可带国际区号加号');
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) missing.push('请填写有效的邮箱地址');
    setFormErrors(missing);
    if (missing.length > 0) return;
    setError(null);
    if (member?.id) {
      update.mutate({ userId: member.id, data: { name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim() } }, {
        onSuccess: () => onSaved(`成员「${form.name.trim()}」资料已更新，请该成员重新登录。`),
        onError: (e) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败，请重试。'),
      });
      return;
    }
    create.mutate(
      {
        data: {
          name: form.name.trim(),
          mobile: form.mobile.trim() || undefined,
          email: form.email.trim() || undefined,
          status: 'active',
          initialPassword: form.password,
        },
      },
      {
        onSuccess: () => onSaved(`成员「${form.name.trim()}」已创建。`),
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              '创建失败,请检查信息后重试。',
          ),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            aria-label="返回成员列表"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-950">{member ? '编辑成员' : '新增成员'}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {member ? '维护成员资料，保存后该成员需重新登录' : '创建企业成员账号'}
              <span className="ml-2 text-xs text-slate-400">(<span className="text-red-500">*</span> 为必填项)</span>
            </p>
          </div>
        </div>
      </div>

      {error && <FeedbackNotice tone="error" message={error} />}
      <FormErrorSummary errors={formErrors} />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        {!member && <p className="mb-4 text-sm text-slate-600">默认角色：业务成员（报价、订单、发货、发票及商品业务权限，无团队管理权限）</p>}
        <p className="mb-4 text-sm text-slate-600">手机号、邮箱至少填写一项，作为登录账号；停用账号的联系方式仍保留占用。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>姓名</span>
            <input className={cn(inputCls, 'mt-1.5')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          {!member && <label className="block">
            <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>初始密码(至少 6 位)</span>
            <input className={cn(inputCls, 'mt-1.5')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>}
          <label className="block">
            <span className="text-xs font-black text-slate-500">手机号（与邮箱至少填一项）</span>
            <input className={cn(inputCls, 'mt-1.5')} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500">邮箱（与手机号至少填一项）</span>
            <input className={cn(inputCls, 'mt-1.5')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <PrimaryActionButton onClick={submit} busy={create.isPending || update.isPending} pendingLabel="保存中" size="md" flushTop>
            {member ? '保存资料' : '创建成员'}
          </PrimaryActionButton>
        </div>
      </section>
    </div>
  );
}

// 员工管理:成员账号列表 + 启停 + 重置密码;新增走独立页。
export function TeamPage({ canManage = false, currentUserId }: { canManage?: boolean; currentUserId?: string }) {
  const queryClient = useQueryClient();
  const users = useSupplierUserList();
  const changeStatus = useSupplierUserChangeStatus();
  const resetPassword = useSupplierUserResetPassword();
  const changeRole = useSupplierUserChangeRole();
  const [roleTarget, setRoleTarget] = useState<{ user: SupplierUserResponse; roleId: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierUserResponse | undefined>();
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = users.isError ? [] : users.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((u) => u.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((u) => {
    if (statusFilter !== '全部' && u.status !== statusFilter) return false;
    if (!kw) return true;
    return [u.name, u.mobile, u.email].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((u) => u.status === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/users'),
    });
  };
  const reportError = (e: unknown) =>
    setError(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试',
    );

  const memberActions = (u: SupplierUserResponse) => canManage && (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      <button type="button" onClick={() => setEditing(u)}
        className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">
        <Pencil size={12} /> 编辑
      </button>
      <button type="button" disabled={resetPassword.isPending}
        onClick={() => u.id && setResetTarget({ id: u.id, name: u.name ?? '' })}
        className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
        <KeyRound size={12} /> 重置密码
      </button>
      <button type="button" disabled={changeStatus.isPending || u.id === currentUserId}
        title={u.id === currentUserId ? '不能停用当前登录账号' : undefined}
        onClick={() => u.id && changeStatus.mutate(
          { userId: u.id, data: { status: u.status === 'active' ? 'inactive' : 'active' } },
          { onSuccess: () => { setFeedback(`已${u.status === 'active' ? '停用' : '启用'}「${u.name}」。`); refresh(); }, onError: reportError },
        )}
        className={cn('inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border px-3 text-xs font-black disabled:opacity-50',
          u.status === 'active' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-700')}>
        {u.status === 'active' ? '停用' : '启用'}
      </button>
    </div>
  );

  const memberRole = (u: SupplierUserResponse) => canManage ? (
    <select aria-label={`${u.name}的角色`} value={u.roleId ?? ''}
      disabled={u.id === currentUserId || changeRole.isPending}
      title={u.id === currentUserId ? '不能修改当前登录账号的角色' : undefined}
      className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold disabled:bg-slate-50 disabled:text-slate-500"
      onChange={(event) => setRoleTarget({ user: u, roleId: event.target.value })}>
      {u.roleId !== MEMBER_ROLE && u.roleId !== OWNER_ROLE && <option value={u.roleId ?? ''} disabled>原有角色</option>}
      <option value={MEMBER_ROLE}>业务成员</option>
      <option value={OWNER_ROLE}>供应商管理员</option>
    </select>
  ) : <span className="text-xs text-slate-600">{roleLabel(u.roleId)}</span>;

  if ((creating || editing) && canManage) {
    return (
      <MemberCreatePage
        member={editing}
        onBack={() => { setCreating(false); setEditing(undefined); }}
        onSaved={(msg) => {
          setCreating(false);
          setEditing(undefined);
          setFeedback(msg);
          refresh();
        }}
      />
    );
  }

  return (
    <>
    <ConfirmDialog open={!!roleTarget && canManage} title={`修改「${roleTarget?.user.name ?? ''}」的角色`}
      message={`将改为${roleLabel(roleTarget?.roleId)}。${roleTarget?.roleId === OWNER_ROLE ? '拥有企业业务及团队管理权限。' : '可办理报价、订单等业务，无团队管理和资质维护权限。'}原有角色授权将被替换，该成员需要重新登录。`}
      confirmLabel="确认修改" busy={changeRole.isPending} onCancel={() => setRoleTarget(null)}
      onConfirm={() => {
        if (!canManage || !roleTarget?.user.id) return;
        changeRole.mutate({ userId: roleTarget.user.id, data: { roleId: roleTarget.roleId } }, {
          onSuccess: () => { setFeedback(`已修改「${roleTarget.user.name}」的角色，请该成员重新登录。`); setRoleTarget(null); refresh(); },
          onError: (e) => { setRoleTarget(null); reportError(e); },
        });
      }} />
    <ConfirmDialog
      open={!!resetTarget && canManage}
      tone="primary"
      title={`重置「${resetTarget?.name ?? ''}」的登录密码`}
      message="重置后旧密码立即失效,请将新密码告知该成员并提醒尽快修改。"
      confirmLabel="确认重置"
      input={{ label: '新密码', type: 'password', minLength: 6, placeholder: '至少 6 位' }}
      busy={resetPassword.isPending}
      onCancel={() => setResetTarget(null)}
      onConfirm={(pwd) => {
        canManage && resetTarget &&
          resetPassword.mutate(
            { userId: resetTarget.id, data: { newPassword: pwd } },
            {
              onSuccess: () => { setFeedback(`已重置「${resetTarget.name}」的登录密码。`); setResetTarget(null); refresh(); },
              onError: (e) => { setResetTarget(null); reportError(e); },
            },
          );
      }}
    />
    <Panel title="员工管理" icon={Users} subtitle="成员账号 · 角色授权 · 启停与密码管理">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({ id: s, label: statusLabel(s), count: s === '全部' ? undefined : statusCount(s) }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-2">
          <SearchInput
            className="mb-0"
            placeholder="按姓名 / 手机 / 邮箱搜索"
            onSearch={(k) => {
              setKeyword(k);
              setPage(1);
            }}
          />
          {canManage && <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> 新增成员
          </button>}
        </div>
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {users.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载成员…" />
      ) : users.isError ? (
        <FeedbackNotice tone="error" message="成员加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={keyword || statusFilter !== '全部' ? '没有符合条件的成员。' : '暂无成员账号,点击「新增成员」创建。'}
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((u, i) => (
              <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {u.name}
                    </p>
                    <p className="mt-1 break-all text-xs font-bold text-slate-500">{u.mobile ?? '—'} · {u.email ?? '—'}</p>
                  </div>
                  {u.status && <span className="shrink-0 whitespace-nowrap"><StatusPill label={statusLabel(u.status)} /></span>}
                </div>
                <div className="mt-3 max-w-48">{memberRole(u)}</div>
                {canManage && <div className="mt-3">{memberActions(u)}</div>}
              </div>
            ))}
          >
            <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-12" /><col className="w-48" /><col className="w-32" />
                <col /><col className="w-40" /><col className="w-20" />{canManage && <col className="w-72" />}
              </colgroup>
              <thead className="whitespace-nowrap bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">姓名</th>
                  <th className="px-5 py-4">手机号</th>
                  <th className="px-5 py-4">邮箱</th>
                  <th className="px-3 py-4">角色</th>
                  <th className="px-5 py-4">状态</th>
                  {canManage && <th className="sticky right-0 z-10 bg-slate-50 px-5 py-4 text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((u, i) => {
                  return (
                    <tr key={u.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="break-words font-black text-slate-950">{u.name}</p>
                        <p className="mt-1 break-all font-mono text-[11px] font-bold text-slate-400">{u.id}</p>
                      </td>
                      <td className="break-all px-5 py-5 font-mono text-xs font-bold text-slate-600">{u.mobile ?? '—'}</td>
                      <td className="break-all px-5 py-5 text-xs font-bold text-slate-600">{u.email ?? '—'}</td>
                      <td className="px-3 py-5">{memberRole(u)}</td>
                      <td className="whitespace-nowrap px-5 py-5">{u.status && <StatusPill label={statusLabel(u.status)} />}</td>
                      {canManage && <td className="sticky right-0 bg-white px-5 py-5 text-right">{memberActions(u)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
    </>
  );
}
