import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Plus, Users } from 'lucide-react';
import {
  useSupplierUserChangeStatus,
  useSupplierUserCreate,
  useSupplierUserList,
  useSupplierUserResetPassword,
} from '@24bid/api-client';
import {
  FilterTabs,
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

const inputCls =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 新增成员独立页:姓名/联系方式/初始密码,创建后可登录供应商门户。
function MemberCreatePage({ onBack, onSaved }: { onBack: () => void; onSaved: (msg: string) => void }) {
  const create = useSupplierUserCreate();
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const ready = form.name.trim() && form.password.trim().length >= 6;

  const submit = () => {
    setError(null);
    create.mutate(
      {
        data: {
          name: form.name.trim(),
          mobile: form.mobile.trim() || undefined,
          email: form.email.trim() || undefined,
          status: '启用',
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
            <h1 className="text-xl font-black text-slate-950">新增成员</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              创建企业成员账号
              <span className="ml-2 text-xs text-slate-400">(<span className="text-red-500">*</span> 为必填项,其余选填)</span>
            </p>
          </div>
        </div>
      </div>

      {error && <FeedbackNotice tone="error" message={error} />}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>姓名</span>
            <input className={cn(inputCls, 'mt-1.5')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>初始密码(至少 6 位)</span>
            <input className={cn(inputCls, 'mt-1.5')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500">手机号(选填)</span>
            <input className={cn(inputCls, 'mt-1.5')} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500">邮箱(选填)</span>
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
          <PrimaryActionButton onClick={submit} busy={create.isPending} pendingLabel="创建中" size="md" flushTop disabled={!ready}>
            创建成员
          </PrimaryActionButton>
        </div>
      </section>
    </div>
  );
}

// 员工管理:成员账号列表 + 启停 + 重置密码;新增走独立页。
export function TeamPage() {
  const queryClient = useQueryClient();
  const users = useSupplierUserList();
  const changeStatus = useSupplierUserChangeStatus();
  const resetPassword = useSupplierUserResetPassword();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = users.data?.data ?? [];
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

  if (creating) {
    return (
      <MemberCreatePage
        onBack={() => setCreating(false)}
        onSaved={(msg) => {
          setCreating(false);
          setFeedback(msg);
          refresh();
        }}
      />
    );
  }

  return (
    <Panel title="员工管理" icon={Users} subtitle="成员账号 · 启停与密码管理">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : statusCount(s) }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            className="mb-0"
            placeholder="按姓名 / 手机 / 邮箱搜索"
            onSearch={(k) => {
              setKeyword(k);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> 新增成员
          </button>
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
                    <p className="mt-1 text-xs font-bold text-slate-500">{u.mobile ?? '—'} · {u.email ?? '—'}</p>
                  </div>
                  {u.status && <StatusPill label={u.status} />}
                </div>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">姓名</th>
                  <th className="px-5 py-4">手机号</th>
                  <th className="px-5 py-4">邮箱</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((u, i) => {
                  const enabled = u.status !== '停用';
                  return (
                    <tr key={u.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-black text-slate-950">{u.name}</p>
                        <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{u.id}</p>
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{u.mobile ?? '—'}</td>
                      <td className="px-5 py-5 text-xs font-bold text-slate-600">{u.email ?? '—'}</td>
                      <td className="px-5 py-5">{u.status && <StatusPill label={u.status} />}</td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={resetPassword.isPending}
                            onClick={() => {
                              const pwd = window.prompt(`为「${u.name}」设置新密码(至少 6 位):`);
                              if (!pwd) return;
                              if (pwd.length < 6) {
                                setError('密码至少 6 位。');
                                return;
                              }
                              u.id &&
                                resetPassword.mutate(
                                  { userId: u.id, data: { newPassword: pwd } },
                                  { onSuccess: () => { setFeedback(`已重置「${u.name}」的登录密码。`); refresh(); }, onError: reportError },
                                );
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <KeyRound size={12} /> 重置密码
                          </button>
                          <button
                            type="button"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              u.id &&
                              changeStatus.mutate(
                                { userId: u.id, data: { status: enabled ? '停用' : '启用' } },
                                { onSuccess: () => { setFeedback(enabled ? `已停用「${u.name}」。` : `已启用「${u.name}」。`); refresh(); }, onError: reportError },
                              )
                            }
                            className={cn(
                              'inline-flex h-8 items-center rounded-md border px-3 text-xs font-black transition disabled:opacity-50',
                              enabled
                                ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                                : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
                            )}
                          >
                            {enabled ? '停用' : '启用'}
                          </button>
                        </div>
                      </td>
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
  );
}
