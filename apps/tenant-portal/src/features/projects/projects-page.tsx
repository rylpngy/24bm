import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Save,
  Send,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  projectList,
  projectDetail,
  projectSave,
  projectAction,
  projectDemands,
  projectLinkDemand,
  projectCreateExecution,
  projectExecution,
  projectBudget,
  projectOptions,
  useMaterialList,
  usePurchaseDemandList,
  type ProcProjectDraft,
  type ProcProjectLine,
} from '@24bid/api-client';
import { FeedbackNotice, Pagination, ConfirmDialog } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { useAuthStore } from '../../lib/auth-store';
import { OwnerAttachments } from '../attachments/owner-attachments';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { projectAmount } from './project-amount';
import { ProjectExpansionPanel } from './project-expansion-panel';
import { ProjectCloseoutPanel } from './project-closeout-panel';
import { ProjectLifecyclePanel } from './project-lifecycle-panel';
import { ProjectReopenPanel } from './project-reopen-panel';
import { ProjectFundingPanel } from '../budgets/special-funding';

const states: Record<string, string> = {
  draft: '草稿',
  submitted: '立项审批中',
  approved: '已批准',
  rejected: '已驳回',
  withdrawn: '已撤回',
  terminated: '已终止',
  closed: '已结项',
};
const btn =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40';
const input =
  'h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal';
const money = (n?: number | null) =>
  n == null
    ? '待核对'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
      }).format(n);
const errorText = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } }).response?.data
    ?.message || '操作失败，请刷新后重试。';
const editable = (status: string) =>
  ['draft', 'rejected', 'withdrawn'].includes(status);
export function ProjectsPage() {
  const { can } = useBuyerPermissions();
  if (!can('buyer:project:read'))
    return <FeedbackNotice tone="error" message="无项目库查看权限。" />;
  return <ProjectWorkspace />;
}
function ProjectWorkspace() {
  const { can } = useBuyerPermissions(),
    client = useQueryClient();
  const [id, setId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('recordId'),
  );
  const [mode, setMode] = useState<'list' | 'detail' | 'edit'>(
    id ? 'detail' : 'list',
  );
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState<{
      tone: 'success' | 'error';
      message: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const [submit, setSubmit] = useState(false),
    [submitError, setSubmitError] = useState<unknown>(),
    [reason, setReason] = useState('');
  const [action, setAction] = useState<
    'withdraw' | 'terminate' | 'close' | 'create-demand' | null
  >(null);
  const [link, setLink] = useState('');
  const [packageCount, setPackageCount] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProcProjectDraft | null>(null);
  const list = useQuery({
    queryKey: ['project-list', page, status, keyword],
    queryFn: () => projectList(page, status, keyword),
  });
  const detail = useQuery({
    queryKey: ['project-detail', id],
    queryFn: () => projectDetail(id!),
    enabled: !!id,
  });
  const options = useQuery({
    queryKey: ['project-options'],
    queryFn: projectOptions,
    enabled: mode === 'edit' && can('buyer:project:manage'),
  });
  const departments = {
    data: { data: options.data?.departments },
    isError: options.isError,
  };
  const users = {
    data: { data: options.data?.users },
    isError: options.isError,
  };
  const materials = useMaterialList(undefined, {
    query: { enabled: mode === 'edit' && can('buyer:material:read') },
  });
  const candidates = usePurchaseDemandList(undefined, {
    query: { enabled: mode === 'detail' && can('buyer:demand:read') },
  });
  const links = useQuery({
    queryKey: ['project-demands', id],
    queryFn: () => projectDemands(id!),
    enabled: !!id && mode === 'detail' && can('buyer:demand:read'),
  });
  const trace = useQuery({
    queryKey: ['project-execution', id],
    queryFn: () => projectExecution(id!),
    enabled: !!id && mode === 'detail' && can('buyer:demand:read'),
  });
  const budget = useQuery({
    queryKey: ['project-budget', id],
    queryFn: () => projectBudget(id!),
    enabled: !!id && mode === 'detail' && can('buyer:budget:read'),
  });
  const p = detail.isError ? undefined : detail.data?.project;
  const userId = useAuthStore((s) => s.session?.userId);
  const refresh = async () => {
    await client.invalidateQueries({
      predicate: (q) =>
        String(q.queryKey[0]).includes('project-') ||
        String(q.queryKey[0]).includes('/buyer/workflow/') ||
        String(q.queryKey[0]).startsWith('workflow-') ||
        String(q.queryKey[0]).includes('/buyer/demands') ||
        String(q.queryKey[0]).includes('/buyer/budgets') ||
        String(q.queryKey[0]).includes('/buyer/mall') ||
        String(q.queryKey[0]).includes('/buyer/orders') ||
        String(q.queryKey[0]).startsWith('budget-'),
    });
  };
  function open(record: string) {
    setId(record);
    setMode('detail');
    setMessage(null);
    const u = new URL(location.href);
    u.searchParams.set('module', 'projects');
    u.searchParams.set('recordId', record);
    history.replaceState(null, '', u);
  }
  function back() {
    setMode('list');
    setId(null);
    setDraft(null);
    setMessage(null);
    const u = new URL(location.href);
    u.searchParams.delete('recordId');
    history.replaceState(null, '', u);
  }
  async function run(fn: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setAction(null);
      setLink('');
      setMessage({ tone: 'success', message: success });
      await refresh();
    } catch (e) {
      setMessage({ tone: 'error', message: errorText(e) });
    } finally {
      setBusy(false);
    }
  }
  function edit() {
    if (!p) return;
    setDraft({
      title: p.title,
      departmentId: p.departmentId,
      ownerId: p.ownerId,
      period: p.period,
      fundingSource: p.fundingSource,
      purpose: p.purpose,
      revision: p.revision,
      lines: detail.data!.lines,
    });
    setMode('edit');
    setMessage(null);
  }
  const rows = list.isError ? [] : list.data?.items || [];
  const sourceMaterials = materials.data?.data || [];
  const allUsers = users.data?.data || [];
  const formDisabled =
    busy ||
    !can('buyer:project:manage') ||
    !can('buyer:material:read') ||
    options.isLoading ||
    materials.isLoading ||
    materials.isError ||
    departments.isError ||
    users.isError;
  const total = projectAmount(draft?.lines || []) || 0;
  const patch = (value: Partial<ProcProjectDraft>) =>
    setDraft((d) => (d ? { ...d, ...value } : d));
  const updateLine = (i: number, value: Partial<ProcProjectLine>) =>
    patch({
      lines: draft!.lines.map((l, n) => (n === i ? { ...l, ...value } : l)),
    });
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {mode !== 'list' && (
            <button
              type="button"
              className={btn}
              onClick={back}
              title="返回项目列表"
              aria-label="返回项目列表"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-slate-950">
              {mode === 'edit'
                ? id
                  ? '编辑项目'
                  : '新建项目'
                : mode === 'detail'
                  ? p?.title || '项目详情'
                  : '项目库'}
            </h1>
            {p && mode === 'detail' && (
              <p className="mt-1 text-xs text-slate-500">
                {p.projectNo} · {states[p.status]}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {mode === 'list' && can('buyer:project:manage') && (
            <button
              type="button"
              className={btn}
              onClick={() => {
                setId(null);
                setDraft({
                  title: '',
                  departmentId: '',
                  ownerId: '',
                  period: String(new Date().getFullYear()),
                  fundingSource: '',
                  purpose: '',
                  lines: [],
                  revision: 0,
                });
                setMode('edit');
                setMessage(null);
              }}
            >
              <Plus size={14} />
              新建项目
            </button>
          )}
          {mode === 'detail' &&
            p &&
            editable(p.status) &&
            can('buyer:project:manage') && (
              <>
                <button type="button" className={btn} onClick={edit}>
                  编辑
                </button>
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  onClick={() => {
                    setReason('');
                    setSubmitError(undefined);
                    setSubmit(true);
                  }}
                >
                  <Send size={14} />
                  提交立项
                </button>
              </>
            )}
          {mode === 'detail' &&
            p &&
            p.status === 'submitted' &&
            p.createdBy === userId &&
            can('buyer:project:manage') && (
              <button
                type="button"
                className={btn}
                onClick={() => setAction('withdraw')}
              >
                撤回立项
              </button>
            )}
          {mode === 'detail' &&
            p &&
            can('buyer:project:manage') &&
            !p.executionId &&
            !['submitted', 'closed', 'terminated'].includes(p.status) && (
              <button
                type="button"
                className={btn}
                onClick={() => setAction('terminate')}
                disabled={p.status === 'approved' && packageCount === null}
              >
                终止项目
              </button>
            )}
          {mode === 'detail' && (
            <button
              type="button"
              className={btn}
              aria-label="刷新项目"
              title="刷新项目"
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </header>
      {message && <FeedbackNotice {...message} />}
      {mode === 'list' && (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setKeyword(search.trim());
            }}
          >
            <input
              aria-label="搜索项目"
              placeholder="项目编号、名称、资金来源"
              className={input + ' sm:max-w-sm'}
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="项目状态"
              className={input + ' sm:max-w-40'}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">全部状态</option>
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button type="submit" className={btn}>
              <Search size={14} />
              搜索
            </button>
          </form>
          {list.isError ? (
            <FeedbackNotice
              tone="error"
              message="项目列表加载失败，请刷新重试。"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[
                      '序号',
                      '项目',
                      '部门 / 负责人',
                      '年度 / 资金来源',
                      '立项金额',
                      '状态',
                      '操作',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={
                          'p-3 ' +
                          (i === 0
                            ? 'w-14'
                            : i === 1
                              ? 'w-60'
                              : i === 6
                                ? 'w-32'
                                : '')
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="p-3 text-slate-400">
                        {(page - 1) * 10 + i + 1}
                      </td>
                      <td className="p-3">
                        <p title={r.title} className="truncate font-bold">
                          {r.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {r.projectNo}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="truncate">{r.departmentName}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {r.ownerName}
                        </p>
                      </td>
                      <td className="p-3">
                        <p>{r.period}</p>
                        <p
                          title={r.fundingSource}
                          className="mt-1 truncate text-xs text-slate-400"
                        >
                          {r.fundingSource}
                        </p>
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {money(r.plannedAmount)}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {states[r.status]}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={btn}
                            onClick={() => open(r.id)}
                          >
                            详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-10 text-center text-slate-400"
                      >
                        {list.isLoading ? '加载中…' : '暂无项目。'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={10}
            total={list.data?.total || 0}
            onPageChange={setPage}
          />
        </section>
      )}
      {mode === 'edit' && draft && (
        <form
          aria-label="项目申报表"
          className="space-y-5 rounded-lg border border-slate-200 bg-white p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (formDisabled) return;
            setBusy(true);
            try {
              const d = await projectSave(draft, id || undefined);
              await refresh();
              open(d.project.id);
            } catch (e) {
              setMessage({ tone: 'error', message: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="项目名称 *">
              <input
                aria-label="项目名称"
                required
                maxLength={200}
                className={input}
                disabled={formDisabled}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </Field>
            <Field label="申报部门 *">
              <select
                aria-label="申报部门"
                required
                disabled={formDisabled}
                className={input}
                value={draft.departmentId}
                onChange={(e) =>
                  patch({ departmentId: e.target.value, ownerId: '' })
                }
              >
                <option value="">请选择</option>
                {departments.data?.data
                  ?.filter((d) => d.status === 'active')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="项目负责人 *">
              <select
                aria-label="项目负责人"
                required
                disabled={formDisabled}
                className={input}
                value={draft.ownerId}
                onChange={(e) => patch({ ownerId: e.target.value })}
              >
                <option value="">请选择</option>
                {allUsers
                  .filter(
                    (u) =>
                      u.status === 'active' &&
                      u.departmentId === draft.departmentId,
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="项目年度 *">
              <input
                aria-label="项目年度"
                required
                pattern="20[0-9]{2}"
                className={input}
                value={draft.period}
                disabled={formDisabled}
                onChange={(e) => patch({ period: e.target.value })}
              />
            </Field>
            <Field label="资金来源 *">
              <input
                aria-label="资金来源"
                required
                maxLength={200}
                className={input}
                disabled={formDisabled}
                value={draft.fundingSource}
                onChange={(e) => patch({ fundingSource: e.target.value })}
              />
            </Field>
            <Field label="明细预算合计">
              <p className="flex h-10 items-center font-bold text-blue-700">
                {money(total)}
              </p>
            </Field>
          </div>
          <Field label="立项依据及用途 *">
            <textarea
              aria-label="立项依据及用途"
              required
              maxLength={4000}
              disabled={formDisabled}
              className="min-h-24 w-full rounded-md border border-slate-200 p-3 text-sm"
              value={draft.purpose}
              onChange={(e) => patch({ purpose: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">采购明细</h2>
            <button
              type="button"
              className={btn}
              disabled={formDisabled}
              onClick={() =>
                patch({
                  lines: [
                    ...draft.lines,
                    { materialId: '', quantity: 1, unitPrice: 0, purpose: '' },
                  ],
                })
              }
            >
              <Plus size={14} />
              添加物料
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    '物料 *',
                    '规格 / 单位',
                    '数量 *',
                    '预算单价 *',
                    '行金额',
                    '用途',
                    '操作',
                  ].map((h) => (
                    <th className="p-2" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((l, i) => {
                  const material = sourceMaterials.find(
                    (m) => m.id === l.materialId,
                  );
                  return (
                    <tr key={i}>
                      <td className="min-w-52 p-2">
                        <select
                          aria-label={`物料${i + 1}`}
                          required
                          disabled={formDisabled}
                          className={input}
                          value={l.materialId}
                          onChange={(e) => {
                            const m = sourceMaterials.find(
                              (m) => m.id === e.target.value,
                            );
                            updateLine(i, {
                              materialId: e.target.value,
                              unitPrice: m?.referencePrice || 0,
                            });
                          }}
                        >
                          <option value="">请选择物料</option>
                          {sourceMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="min-w-32 p-2">
                        <p>{material?.specification || '—'}</p>
                        <p className="text-xs text-slate-500">
                          {material?.unit || '—'}
                        </p>
                      </td>
                      <td className="w-28 p-2">
                        <input
                          aria-label={`数量${i + 1}`}
                          required
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          disabled={formDisabled}
                          className={input}
                          value={l.quantity}
                          onChange={(e) =>
                            updateLine(i, { quantity: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="w-32 p-2">
                        <input
                          aria-label={`预算单价${i + 1}`}
                          required
                          type="number"
                          min="0"
                          step="0.0001"
                          disabled={formDisabled}
                          className={input}
                          value={l.unitPrice}
                          onChange={(e) =>
                            updateLine(i, { unitPrice: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {money(projectAmount([l]))}
                      </td>
                      <td className="p-2">
                        <input
                          aria-label={`物料用途${i + 1}`}
                          maxLength={1000}
                          className={input}
                          disabled={formDisabled}
                          value={l.purpose}
                          onChange={(e) =>
                            updateLine(i, { purpose: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          title="移除明细"
                          aria-label={`移除明细${i + 1}`}
                          className={btn}
                          disabled={formDisabled}
                          onClick={() =>
                            patch({
                              lines: draft.lines.filter((_, n) => n !== i),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(!draft.lines.length || total <= 0) && (
            <FeedbackNotice
              tone="info"
              message="至少添加一条有效物料，明细预算合计须大于0。"
            />
          )}
          {(users.isError || materials.isError || departments.isError) && (
            <FeedbackNotice
              tone="error"
              message="基础资料加载失败，请刷新后再保存。"
            />
          )}
          <footer className="flex justify-end gap-2">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => (id ? setMode('detail') : back())}
            >
              取消
            </button>
            <button
              type="submit"
              className={btn}
              disabled={formDisabled || !draft.lines.length || total <= 0}
            >
              <Save size={14} />
              保存草稿
            </button>
          </footer>
        </form>
      )}
      {mode === 'detail' &&
        (detail.isError ? (
          <FeedbackNotice
            tone="error"
            message="项目详情加载失败或无访问权限。"
          />
        ) : (
          p && (
            <>
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="mb-4 font-bold">基础信息</h2>
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    {[
                      ['申报部门', p.departmentName],
                      ['项目负责人', p.ownerName],
                      ['年度', p.period],
                      ['资金来源', p.fundingSource],
                      ['立项金额', money(p.plannedAmount)],
                      ['当前状态', states[p.status]],
                      ['立项依据及用途', p.purpose],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-slate-400">{k}</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <h3 className="mb-3 mt-6 font-bold">立项采购明细</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs">
                        <tr>
                          {[
                            '物料 / 规格',
                            '数量 / 单位',
                            '预算单价',
                            '行金额',
                            '用途',
                          ].map((h) => (
                            <th className="p-2" key={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.data?.lines.map((l, i) => (
                          <tr
                            key={l.id || i}
                            className="border-b border-slate-100"
                          >
                            <td className="p-2">
                              {l.name}
                              <p className="text-xs text-slate-400">
                                {l.specification || '—'}
                              </p>
                            </td>
                            <td className="p-2">
                              {l.quantity} {l.unit}
                            </td>
                            <td className="p-2">{money(l.unitPrice)}</td>
                            <td className="p-2">{money(projectAmount([l]))}</td>
                            <td className="p-2">{l.purpose || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <aside className="min-w-0 space-y-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-3 font-bold">部门年度预算</h2>
                    {!can('buyer:budget:read') ? (
                      <p className="text-sm text-slate-500">无预算查看权限。</p>
                    ) : budget.isError ? (
                      <FeedbackNotice
                        tone="error"
                        message="预算读取失败，请刷新重试。"
                      />
                    ) : budget.data ? (
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        {[
                          [
                            '生效额度',
                            budget.data.configured
                              ? money(budget.data.totalAmount)
                              : '未配置',
                          ],
                          [
                            '年度占用',
                            money(budget.data.pending + budget.data.committed),
                          ],
                          [
                            '可用余额',
                            money(
                              budget.data.totalAmount -
                                budget.data.pending -
                                budget.data.committed,
                            ),
                          ],
                          ['已核实净付款', money(budget.data.paidAmount)],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs text-slate-400">{k}</dt>
                            <dd className="mt-1 font-bold">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-400">加载中…</p>
                    )}
                  </section>
                  <OwnerAttachments
                    ownerType="procurement_project"
                    ownerId={p.id}
                    readOnly={
                      !can('buyer:project:manage') || !editable(p.status)
                    }
                    title="项目附件"
                  />
                </aside>
              </div>
              {can('buyer:workflow:read') ? (
                <WorkflowStatusPanel
                  businessType="project_initiation"
                  businessId={p.id}
                  hideBusinessSnapshot
                />
              ) : (
                <FeedbackNotice tone="info" message="无流程历史查看权限。" />
              )}
              {['approved', 'closed', 'terminated'].includes(p.status) && (
                <ProjectExpansionPanel
                  key={p.id}
                  project={p}
                  lines={detail.data?.lines || []}
                  demands={links.isError ? [] : links.data || []}
                  onChanged={refresh}
                  onPackagesReady={setPackageCount}
                />
              )}
              {['approved', 'closed', 'terminated'].includes(p.status) && (
                <>
                <ProjectReopenPanel key={'reopen-'+p.id} project={p} onChanged={refresh}/>
                <ProjectLifecyclePanel key={'lifecycle-'+p.id} project={p} onChanged={refresh}/>
                </>
              )}
              {['approved','closed','terminated'].includes(p.status)&&<ProjectFundingPanel key={'funding-'+p.id} project={p}/>}
              {['approved', 'closed', 'terminated'].includes(p.status) && (
                <ProjectCloseoutPanel
                  key={'monitor-' + p.id}
                  project={p}
                  onChanged={refresh}
                />
              )}
              <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                <header className="flex flex-wrap justify-between gap-3">
                  <h2 className="font-bold">关联采购需求</h2>
                  {p.status === 'approved' &&
                    !p.executionId &&
                    packageCount === 0 &&
                    can('buyer:project:manage') &&
                    can('buyer:demand:create') &&
                    !links.data?.length && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy || links.isError || links.isLoading}
                        onClick={() => setAction('create-demand')}
                      >
                        <Plus size={14} />
                        按立项明细生成需求
                      </button>
                    )}
                </header>
                {links.isError ? (
                  <FeedbackNotice
                    tone="error"
                    message="关联需求加载失败或无权限。"
                  />
                ) : (
                  <div className="space-y-2">
                    {links.data?.map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-bold">{d.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {d.id} · {d.status} · {money(d.budget)}
                          </p>
                        </div>
                        <a
                          className={btn}
                          href={`?module=demands&recordId=${encodeURIComponent(d.id)}`}
                        >
                          <ExternalLink size={13} />
                          详情
                        </a>
                      </div>
                    ))}
                    {!links.data?.length && (
                      <p className="text-sm text-slate-400">暂无关联需求。</p>
                    )}
                  </div>
                )}
                {p.status === 'approved' &&
                  !p.executionId &&
                  packageCount === 0 &&
                  can('buyer:project:manage') &&
                  can('buyer:demand:read') && (
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label="关联已有需求"
                        className={input + ' sm:max-w-md'}
                        value={link}
                        disabled={busy || candidates.isError}
                        onChange={(e) => setLink(e.target.value)}
                      >
                        <option value="">选择同部门年度的未转采购需求</option>
                        {candidates.data?.data
                          ?.filter(
                            (d) =>
                              d.departmentId === p.departmentId &&
                              !!d.createdAt &&
                              new Intl.DateTimeFormat('en', {
                                timeZone: 'Asia/Shanghai',
                                year: 'numeric',
                              }).format(new Date(d.createdAt)) === p.period &&
                              ['草稿', '审批中', '已通过', '已驳回'].includes(
                                d.status || '',
                              ) &&
                              !d.linkedRfqId &&
                              !links.data?.some((l) => l.id === d.id),
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.title} · {d.status}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className={btn}
                        disabled={busy || !link || candidates.isError}
                        onClick={() =>
                          void run(
                            () => projectLinkDemand(p.id, p.revision, link),
                            '需求已关联。',
                          )
                        }
                      >
                        关联需求
                      </button>
                    </div>
                  )}
                <div className="flex flex-wrap gap-2">
                  {p.status === 'approved' &&
                    !p.executionId &&
                    packageCount === 0 &&
                    can('buyer:project:manage') &&
                    !!links.data?.length &&
                    links.data.every((d) => d.status === '已通过') && (
                      <>
                        {can('buyer:rfq:manage') && (
                          <button
                            type="button"
                            className={btn}
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () =>
                                  projectCreateExecution(
                                    p.id,
                                    p.revision,
                                    'rfq',
                                  ),
                                '询比草稿已创建，请进入询比项目完善并发布。',
                              )
                            }
                          >
                            创建询比采购
                          </button>
                        )}
                        {can('buyer:tender:manage') && (
                          <button
                            type="button"
                            className={btn}
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () =>
                                  projectCreateExecution(
                                    p.id,
                                    p.revision,
                                    'tender',
                                  ),
                                '招标草稿已创建，请进入招标管理完善并发布。',
                              )
                            }
                          >
                            创建招标采购
                          </button>
                        )}
                      </>
                    )}
                  {p.executionId && (
                    <a
                      className={btn}
                      href={`?module=${p.executionType === 'tender' ? 'tenders' : 'rfqs'}&recordId=${encodeURIComponent(p.executionId)}`}
                    >
                      <ExternalLink size={13} />
                      采购执行详情
                    </a>
                  )}
                </div>
              </section>
              <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                <header className="flex justify-between gap-3">
                  <h2 className="font-bold">采购执行与结算</h2>
                  {p.status === 'approved' &&
                    trace.data?.canClose &&
                    can('buyer:project:manage') && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy || trace.isError || trace.isFetching}
                        onClick={() => setAction('close')}
                      >
                        核验并结项归档
                      </button>
                    )}
                </header>
                {trace.isError ? (
                  <FeedbackNotice
                    tone="error"
                    message="执行台账加载失败或缺少关联业务查看权限，请刷新或联系管理员。"
                  />
                ) : (
                  trace.data && (
                    <>
                      <dl className="grid gap-4 text-sm sm:grid-cols-4">
                        {[
                          ['需求金额', trace.data.demandAmount],
                          ['订单金额', trace.data.orderAmount],
                          ['有效开票', trace.data.invoicedAmount],
                          ['净付款', trace.data.paidAmount],
                        ].map(([k, v]) => (
                          <div key={String(k)}>
                            <dt className="text-xs text-slate-400">{k}</dt>
                            <dd className="mt-1 font-bold">
                              {money(v as number | null)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {trace.data.warnings.length > 0 && (
                        <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                          {trace.data.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[650px] text-left text-sm">
                          <thead className="bg-slate-50 text-xs text-slate-500">
                            <tr>
                              {['业务单据', '状态', '金额', '操作'].map((h) => (
                                <th className="p-3" key={h}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {trace.data.documents.map((d, i) => (
                              <tr
                                className="border-b border-slate-100"
                                key={d.type + d.id + i}
                              >
                                <td
                                  className="max-w-96 truncate p-3"
                                  title={d.title}
                                >
                                  {d.title}
                                </td>
                                <td className="whitespace-nowrap p-3">
                                  {d.status}
                                </td>
                                <td className="whitespace-nowrap p-3">
                                  {d.amount == null ? '—' : money(d.amount)}
                                </td>
                                <td className="p-3">
                                  <a
                                    className={btn}
                                    href={`?module=${encodeURIComponent(d.module)}&recordId=${encodeURIComponent(d.recordId)}`}
                                  >
                                    详情
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                )}
              </section>
            </>
          )
        ))}
      {submit && p && (
        <WorkflowSubmitDialog
          businessType="project_initiation"
          title="提交项目立项审批"
          busy={busy}
          submissionError={submitError}
          onClose={() => setSubmit(false)}
          onSubmit={async (form) => {
            if (!reason.trim()) {
              setSubmitError(new Error('请填写提交说明。'));
              return;
            }
            setBusy(true);
            try {
              await projectAction(p.id, 'submit', p.revision, reason, form);
              setSubmit(false);
              await refresh();
            } catch (e) {
              setSubmitError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="提交说明 *">
            <textarea
              aria-label="立项提交说明"
              required
              maxLength={1000}
              className="min-h-20 w-full rounded-md border border-slate-200 p-3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </WorkflowSubmitDialog>
      )}
      <ConfirmDialog
        open={!!action}
        title={
          action === 'close'
            ? '项目结项归档'
            : action === 'withdraw'
              ? '撤回立项审批'
              : action === 'terminate'
                ? '终止项目'
                : '生成采购需求'
        }
        message={
          action === 'close'
            ? '将核验实际履约、付款及未决事项，生成不可变归档；未满足条件不能结项。'
            : action === 'create-demand'
              ? '按已批准的立项明细创建需求草稿，需求仍须独立审批，不重复扣减预算。'
              : action === 'terminate'
                ? '仅未采购或无订单且已流标/废标的范围可终止；本人发起的在审需求先撤回，相关需求取消并释放占用，原审批与业务历史保留。存在订单、有效采购或未处理变更时禁止直接终止。'
                : '保留原项目及完整审批历史。'
        }
        input={{ label: '操作原因', placeholder: '请填写依据', minLength: 1 }}
        confirmLabel="确认办理"
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={(text) => {
          if (p && action)
            void run(
              () => projectAction(p.id, action, p.revision, text),
              '操作已完成。',
            );
        }}
      />
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-bold text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}
