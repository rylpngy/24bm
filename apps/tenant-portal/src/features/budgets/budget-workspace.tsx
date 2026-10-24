import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Eye, Pencil, Plus, Send, Undo2, X, Check, XCircle } from 'lucide-react';
import {
  axiosInstance, type BudgetDraftInput, type BudgetRequestItem, type BudgetControlPolicy,
  useBudgetPoolPositions, useBudgetControlPolicy, useBudgetDepartments, useBudgetChangeRequests,
  useBudgetChangeRequest, useBudgetCommitments, useBudgetMissingOrders, useBudgetLifecycleMutation,
  useUnifiedWorkflowInstanceHistory, useWorkflowRuntimeTasks, useUnifiedWorkflowCompleteTask,
} from '@24bid/api-client';
import { FeedbackNotice, Tabs } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { useAuthStore } from '../../lib/auth-store';
import { WorkflowInstancePanel } from '../workflow/workflow-instance-panel';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';

const field = 'mt-1 h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50';
const button = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40';
const primary = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40';
const cell = 'px-4 py-3 text-sm';
const kinds: Record<string, string> = { initial: '预算编制', adjustment: '预算调整', exception: '超额例外' };
const statuses: Record<string, string> = { draft: '草稿', submitted: '审批中', approved: '已通过', rejected: '已驳回', withdrawn: '已撤回' };
const modes: Record<string, string> = { warning: '预警模式', approval: '超额审批', hard: '硬拦截' };
const sources: Record<string, string> = { demand: '采购需求', rfq: '采购项目', order: '无需求订单' };
export const formatBudgetAmount = (value: number | null | undefined) => value == null ? '待核对' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = formatBudgetAmount;
const errorText = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败，请重试。';
const currentYear = () => new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date());

function Pager({ page, total, busy, onChange }: { page: number; total: number; busy?: boolean; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
    <span>共 {total} 条</span><div className="flex items-center gap-3">
      <button type="button" className={button} disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}>上一页</button>
      <span>{page} / {pages}</span><button type="button" className={button} disabled={page >= pages || busy} onClick={() => onChange(page + 1)}>下一页</button>
    </div>
  </div>;
}

function BudgetDialog({ title, busy, children, close }: { title: string; busy: boolean; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-6">
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) close();
        if (event.key === 'Tab') {
          const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),a[href]') ?? []);
          const first = controls[0]; const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-base font-black text-slate-900">{title}</h2>
        <button type="button" title="关闭" aria-label="关闭" disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-40" onClick={close}><X size={18} /></button>
      </div>{children}
    </div>
  </div>;
}

export function BudgetWorkspace() {
  const { can } = useBuyerPermissions();
  const userId = useAuthStore((state) => state.session?.userId);
  const client = useQueryClient();
  const [view, setView] = useState('overview');
  const [year, setYear] = useState(currentYear);
  const [department, setDepartment] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get('recordId') ?? undefined);
  const [form, setForm] = useState<BudgetDraftInput | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState<BudgetRequestItem | null>(null);
  const [withdraw, setWithdraw] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [assignId, setAssignId] = useState<string | undefined>();
  const [assignDepartment, setAssignDepartment] = useState('');
  const [assignPeriod, setAssignPeriod] = useState(currentYear);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [comment, setComment] = useState('');
  const positions = useBudgetPoolPositions(); const policy = useBudgetControlPolicy(); const departments = useBudgetDepartments();
  const requests = useBudgetChangeRequests(kind, page); const ledger = useBudgetCommitments(department, year, page);
  const current = useBudgetChangeRequest(selected);
  const history = useUnifiedWorkflowInstanceHistory(can('buyer:workflow:read') ? current.data?.data?.workflowInstanceId : undefined);
  const tasks = useWorkflowRuntimeTasks(Boolean(selected) && can('buyer:workflow:review'));
  const mutation = useBudgetLifecycleMutation(); const complete = useUnifiedWorkflowCompleteTask();
  const config = policy.isError ? undefined : policy.data?.data;
  const configure = Boolean(config?.canConfigure);
  const missing = useBudgetMissingOrders(configure && can('buyer:order:read') && view === 'policy', page);
  const pools = positions.isError ? [] : positions.data?.data ?? [];
  const visiblePools = pools.filter((pool) => pool.period === year && (!department || pool.departmentId === department));
  const departmentsById = new Map((departments.data?.data ?? []).map((item) => [item.id, item.name]));
  const records = requests.data?.data; const lines = ledger.data?.data;
  const busy = mutation.isPending || complete.isPending;
  const canManage = can('buyer:budget:manage');
  useEffect(() => {
    if (!canManage) { setForm(null); setSubmitting(null); setWithdraw(undefined); }
    if (!configure) setAssignId(undefined);
  }, [canManage, configure]);
  useEffect(() => {
    const query = view === 'requests' ? requests : view === 'ledger' ? ledger : view === 'policy' ? missing : null;
    if (query?.data?.data && !query.isError && !query.isFetching) {
      const last = Math.max(1, Math.ceil(query.data.data.total / 20));
      if (page > last) setPage(last);
    }
  }, [view, page, requests.data, requests.isError, requests.isFetching, ledger.data, ledger.isError, ledger.isFetching, missing.data, missing.isError, missing.isFetching]);
  const refresh = () => {
    void client.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string'
      && (query.queryKey[0].includes('/buyer/budgets') || query.queryKey[0].includes('/buyer/workflow/')) });
  };
  const openDetail = (id: string) => { setSelected(id); setComment(''); complete.reset(); };
  const openForm = (record?: BudgetRequestItem, edit = false) => {
    mutation.reset(); setFeedback(null); setEditingId(edit ? record?.id : undefined);
    setForm(record ? { departmentId: record.departmentId, period: record.period, kind: record.kind === 'initial' && !edit
      && pools.some((pool) => pool.departmentId === record.departmentId && pool.period === record.period && pool.version > 0) ? 'adjustment' : record.kind,
    targetAmount: record.targetAmount, title: record.title, reason: record.reason, revision: record.revision,
    targetType: record.targetType ?? null, targetId: record.targetId ?? null } : {
      departmentId: department, period: year, kind: 'initial', targetAmount: Number.NaN, title: '', reason: '', revision: 0, targetType: null, targetId: null,
    });
  };
  const run = (input: Parameters<typeof mutation.mutate>[0], done?: () => void) => mutation.mutate(input, {
    onSuccess: () => { setFeedback({ tone: 'success', message: '操作已完成。' }); refresh(); done?.(); },
    onError: (error) => setFeedback({ tone: 'error', message: errorText(error) }),
  });
  const exportLedger = async () => {
    setExporting(true); setFeedback(null);
    try {
      const response = await axiosInstance.get('/api/v1/buyer/budgets/ledger/export', { params: { departmentId: department, period: year }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob); const link = document.createElement('a');
      link.href = url; link.download = `预算占用台账-${year}.xlsx`; link.click(); URL.revokeObjectURL(url);
    } catch (error) {
      const data = (error as { response?: { data?: unknown } }).response?.data;
      if (data instanceof Blob) { try { setFeedback({ tone: 'error', message: JSON.parse(await data.text()).message ?? '导出失败。' }); } catch { setFeedback({ tone: 'error', message: '导出失败，请重试。' }); } }
      else setFeedback({ tone: 'error', message: errorText(error) });
    } finally { setExporting(false); }
  };
  const draftControls = (record: BudgetRequestItem) => record.createdBy === userId && can('buyer:budget:manage');
  const detail = current.isError ? undefined : current.data?.data;
  const task = tasks.isError ? undefined : tasks.data?.data?.find((item) => item.workflowInstanceId === detail?.workflowInstanceId);
  const canHandle = detail?.status === 'submitted' && detail.createdBy !== userId && can('buyer:workflow:review') && !history.isError && !history.isFetching
    && !tasks.isFetching && history.data?.data?.status === 'processing' && task?.taskId === history.data?.data?.currentTask?.taskId && Boolean(task);
  const handleTask = (action: 'approve' | 'reject') => {
    if (!canHandle || !task) return;
    complete.mutate({ taskId: task.taskId, data: { action, comment } }, {
      onSuccess: () => { setComment(''); refresh(); setFeedback({ tone: 'success', message: action === 'approve' ? '审批已通过。' : '审批已驳回。' }); },
    });
  };
  const filters = <div className="flex flex-wrap items-center gap-3">
    <label className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">年度<input aria-label="预算年度" className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500" value={year} maxLength={4} pattern="[0-9]{4}" onChange={(event) => { setYear(event.target.value); setPage(1); }} /></label>
    <select aria-label="筛选部门" className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 sm:w-64" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}>
      <option value="">全部可见部门</option>{(departments.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </div>;
  return <div className="mx-auto max-w-7xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center gap-3">{selected && <button type="button" className={button} onClick={() => { setSelected(undefined); const params = new URLSearchParams(window.location.search); params.delete('recordId'); window.history.replaceState({}, '', '?' + params.toString()); }}><ArrowLeft size={14} />返回预算列表</button>}
        <h1 className="text-xl font-black text-slate-950">{selected ? '预算申请详情' : '预算管理'}</h1>
        <span className="whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{config ? modes[config.mode] : '策略未加载'}</span>
      </div>
      {!selected && can('buyer:budget:manage') && <button type="button" className={primary} onClick={() => openForm()}><Plus size={15} />新建预算申请</button>}
    </header>
    {feedback && <FeedbackNotice tone={feedback.tone} message={feedback.message} />}
    {selected ? current.isLoading ? <FeedbackNotice tone="info" message="正在读取预算申请…" /> : !detail ? <FeedbackNotice tone="error" message="预算申请读取失败或无权查看。" /> : <>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="min-w-0"><h2 className="break-words text-lg font-black">{detail.title}</h2><p className="mt-1 break-all font-mono text-xs text-slate-400">{detail.id}</p></div><span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-bold">{statuses[detail.status]}</span></div>
        <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries({ '申请类型': kinds[detail.kind], '预算部门': departmentsById.get(detail.departmentId) ?? detail.departmentId, '预算年度': detail.period,
            '原生效额度': money(detail.baseAmount), [detail.kind === 'exception' ? '本次总占用上限' : '申请生效额度']: money(detail.targetAmount), '基线版本': String(detail.baseVersion),
            ...(detail.targetId ? { '例外业务类型': detail.targetType === 'department_order' ? '单次无需求订单事务' : detail.targetType === 'rfq' ? '采购项目' : '采购需求', '例外业务编号': detail.targetId } : {}),
            ...(detail.expiresAt ? { '例外有效期至': detail.expiresAt.slice(0, 19), '例外使用状态': detail.consumedAt ? '已使用' : '尚未使用' } : {}),
          }).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">{value}</dd></div>)}
          <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-bold text-slate-500">申请依据</dt><dd className="mt-2 whitespace-pre-wrap break-words">{detail.reason}</dd></div>
        </dl>
        {detail.targetId && detail.targetType !== 'department_order' && <a className="mt-4 inline-flex text-sm font-bold text-blue-700" href={`/?module=${detail.targetType === 'rfq' ? 'rfqs' : 'demands'}&recordId=${encodeURIComponent(detail.targetId)}`}>查看关联业务</a>}
        {draftControls(detail) && <div className="mt-5 flex flex-wrap justify-end gap-2">
          {detail.status === 'draft' && <><button type="button" className={button} disabled={busy} onClick={() => openForm(detail, true)}><Pencil size={14} />编辑草稿</button><button type="button" className={primary} disabled={busy} onClick={() => { mutation.reset(); setSubmitting(detail); }}><Send size={14} />提交审批</button></>}
          {detail.status === 'submitted' && <button type="button" className={button} disabled={busy} onClick={() => { mutation.reset(); setReason(''); setWithdraw(detail.id); }}><Undo2 size={14} />撤回申请</button>}
          {['rejected', 'withdrawn'].includes(detail.status) && <button type="button" className={button} onClick={() => openForm(detail)}><Plus size={14} />重新申请</button>}
        </div>}
      </section>
      {detail.workflowInstanceId && (history.isError ? <FeedbackNotice tone="error" message="审批历史读取失败。" /> : history.data?.data ? <WorkflowInstancePanel history={history.data.data} /> : <FeedbackNotice tone="info" message={can('buyer:workflow:read') ? '正在读取审批历史…' : '当前账号没有流程历史查看权限。'} />)}
      {canHandle && <section className="rounded-lg border border-slate-200 bg-white p-5"><label className="block text-sm font-bold">审批意见<textarea aria-label="审批意见" className={field + ' h-24 py-2'} value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)} /></label><div className="mt-3 flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => handleTask('reject')}><XCircle size={14} />驳回</button><button type="button" className={primary} disabled={busy} onClick={() => handleTask('approve')}><Check size={14} />通过</button></div></section>}
      {complete.isError && <FeedbackNotice tone="error" message={errorText(complete.error)} />}
    </> : <>
      <Tabs value={view} items={[{ id: 'overview', label: '预算总览' }, { id: 'requests', label: '预算申请' }, { id: 'ledger', label: '占用台账' }, { id: 'policy', label: '控制策略' }]} onChange={(value) => { setView(value); setPage(1); }} />
      {view === 'overview' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">{filters}</div>
        {positions.isError ? <div className="p-5"><FeedbackNotice tone="error" message="预算总览加载失败。" /></div> : positions.isLoading ? <div className="p-5">正在加载预算…</div> : <>
          <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-5 py-4 sm:grid-cols-3">{[['生效预算', visiblePools.reduce((sum, row) => sum + row.totalAmount, 0)], ['当前占用', visiblePools.reduce((sum, row) => sum + row.pending + row.committed, 0)], ['可用余额', visiblePools.reduce((sum, row) => sum + row.totalAmount - row.pending - row.committed, 0)]].map(([label, amount]) => <div key={String(label)}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{money(Number(amount))}</p></div>)}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="bg-slate-50 text-xs font-bold text-slate-500"><tr>{['部门 / 年度', '生效额度', '审批中预占', '正式占用', '净实付', '可用余额', '结算释放', '状态'].map((label) => <th key={label} className={cell}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visiblePools.map((row) => <tr key={row.departmentId + row.period}><td className={cell}><p className="font-bold">{row.departmentName || row.departmentId || '未归属部门'}</p><p className="text-xs text-slate-400">{row.period} · v{row.version}</p></td>{[row.totalAmount, row.pending, row.committed, row.paidAmount, row.totalAmount - row.pending - row.committed, row.releasedAmount].map((value, index) => <td key={index} className={cell + ' whitespace-nowrap tabular-nums'}>{money(value)}</td>)}<td className={cell}><span className={row.totalAmount < row.pending + row.committed ? 'font-bold text-red-600' : 'text-emerald-700'}>{!row.configured ? '未编制' : row.totalAmount < row.pending + row.committed ? '超预算' : '正常'}</span></td></tr>)}</tbody></table></div>
          {!visiblePools.length && <p className="p-5 text-sm text-slate-500">当前筛选下暂无生效预算或占用记录。</p>}
          <p className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500">净实付为“待核对”表示历史付款缺少流水或不能可靠分摊，不能按零计算。正式占用已包含订单和实付，不再次相加。</p>
        </>}
      </section>}
      {view === 'requests' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h2 className="text-sm font-black">预算编制、调整与例外申请</h2><select aria-label="申请类型筛选" className={field + ' mt-0 w-auto'} value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="">全部申请类型</option>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {requests.isError ? <div className="p-5"><FeedbackNotice tone="error" message="预算申请加载失败。" /></div> : requests.isLoading ? <p className="p-5">正在读取申请…</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['序号', '申请名称', '类型', '部门 / 年度', '原额度', '申请额度 / 上限', '状态', '操作'].map((label) => <th key={label} className={cell}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{records?.items.map((row, index) => <tr key={row.id}><td className={cell}>{(page - 1) * 20 + index + 1}</td><td className={cell + ' max-w-64'}><p className="truncate font-bold" title={row.title}>{row.title}</p><p className="mt-1 truncate font-mono text-xs text-slate-400" title={row.id}>{row.id}</p></td><td className={cell + ' whitespace-nowrap'}>{kinds[row.kind]}</td><td className={cell}>{departmentsById.get(row.departmentId) ?? row.departmentId}<p className="text-xs text-slate-400">{row.period}</p></td><td className={cell + ' whitespace-nowrap'}>{money(row.baseAmount)}</td><td className={cell + ' whitespace-nowrap'}>{money(row.targetAmount)}</td><td className={cell + ' whitespace-nowrap'}>{statuses[row.status]}</td><td className={cell}><div className="flex justify-end gap-2 whitespace-nowrap"><button type="button" className={button} onClick={() => openDetail(row.id)}><Eye size={14} />详情</button>{row.status === 'draft' && draftControls(row) && <><button type="button" title="编辑草稿" aria-label={'编辑 ' + row.title} className={button} disabled={busy} onClick={() => openForm(row, true)}><Pencil size={14} /></button><button type="button" title="提交审批" aria-label={'提交 ' + row.title} className={button} disabled={busy} onClick={() => { mutation.reset(); setSubmitting(row); }}><Send size={14} /></button></>}</div></td></tr>)}</tbody></table></div>{!records?.items.length && <p className="p-5 text-sm text-slate-500">暂无预算申请。</p>}<Pager page={page} total={records?.total ?? 0} busy={requests.isFetching} onChange={setPage} /></>}
      </section>}
      {view === 'ledger' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">{filters}<button type="button" className={button} disabled={exporting || ledger.isError} onClick={() => void exportLedger()}><Download size={14} />{exporting ? '导出中…' : '导出占用台账'}</button></div>
        {ledger.isError ? <div className="p-5"><FeedbackNotice tone="error" message="占用台账加载失败。" /></div> : ledger.isLoading ? <p className="p-5">正在读取占用…</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['序号', '来源 / 单据', '部门 / 年度', '预占', '正式占用', '关联订单', '净实付', '已释放结余'].map((label) => <th key={label} className={cell}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{lines?.items.map((row, index) => <tr key={row.departmentId + row.period + row.sourceType + row.sourceId}><td className={cell}>{(page - 1) * 20 + index + 1}</td><td className={cell + ' max-w-72'}><a className="block truncate font-bold text-blue-700" title={row.label} href={`/?module=${row.sourceType === 'demand' ? 'demands' : row.sourceType === 'rfq' ? 'rfqs' : 'orders'}&recordId=${encodeURIComponent(row.sourceId)}`}>{sources[row.sourceType]} · {row.label}</a><p className="truncate font-mono text-xs text-slate-400">{row.sourceId}</p></td><td className={cell}>{departmentsById.get(row.departmentId) ?? row.departmentId}<p className="text-xs text-slate-400">{row.period}</p></td>{[row.pending, row.committed, row.orderAmount, row.paidAmount, row.releasedAmount].map((value, index) => <td key={index} className={cell + ' whitespace-nowrap tabular-nums'}>{money(value)}</td>)}</tr>)}</tbody></table></div>{!lines?.items.length && <p className="p-5 text-sm text-slate-500">当前筛选下暂无占用。</p>}<Pager page={page} total={lines?.total ?? 0} busy={ledger.isFetching} onChange={setPage} /></>}
      </section>}
      {view === 'policy' && <section className="rounded-lg border border-slate-200 bg-white p-5">
        {policy.isError ? <FeedbackNotice tone="error" message="预算策略加载失败。" /> : config ? <>
          <PolicyEditor key={config.revision} policy={config} busy={busy} save={(data) => run({ action: 'policy', data })} />
          <div className="mt-5 border-t border-slate-100 pt-5"><h2 className="text-sm font-black">历史数据核对</h2><p className="mt-2 text-sm text-slate-600">未归属订单 {config.unassignedOrderCount} 条 · 预算资料不完整需求 {config.invalidDemandCount} 条</p>
            {configure && can('buyer:order:read') && (missing.isError ? <FeedbackNotice tone="error" message="待归属订单加载失败。" /> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-slate-50"><tr>{['订单编号', '金额', '状态', '操作'].map((label) => <th className={cell} key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{missing.data?.data?.items.map((order) => <tr key={order.id}><td className={cell + ' font-mono text-xs'}>{order.id}</td><td className={cell}>{money(order.amount)}</td><td className={cell}>{order.status}</td><td className={cell}><button type="button" className={button} onClick={() => { setAssignId(order.id); setAssignDepartment(''); setAssignPeriod(currentYear()); setReason(''); mutation.reset(); }}>设置预算归属</button></td></tr>)}</tbody></table></div>)}
            {configure && can('buyer:order:read') && !missing.isError && <Pager page={page} total={missing.data?.data?.total ?? 0} busy={missing.isFetching} onChange={setPage} />}
          </div>
        </> : <p className="text-sm text-slate-500">正在读取策略…</p>}
      </section>}
    </>}
    {submitting && <WorkflowSubmitDialog businessType={submitting.kind === 'exception' ? 'budget_exception' : 'budget_change'} title={submitting.title}
      busy={busy} submissionError={mutation.error} onClose={() => setSubmitting(null)}
      onSubmit={(formData) => run({ action: 'submit', id: submitting.id, data: { formData } }, () => setSubmitting(null))}>
      <p className="text-sm text-slate-600">{kinds[submitting.kind]} · {submitting.period} · {money(submitting.targetAmount)}</p>
    </WorkflowSubmitDialog>}
    {form && <BudgetDialog title={editingId ? '编辑预算草稿' : '新建预算申请'} busy={busy} close={() => setForm(null)}>
      <form className="p-5" onSubmit={(event: FormEvent) => { event.preventDefault(); if (!Number.isFinite(form.targetAmount) || busy) return; run(editingId ? { action: 'edit', id: editingId, data: form } : { action: 'create', data: form }, () => { setForm(null); setView('requests'); setPage(1); }); }}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">申请类型 <b className="text-red-600">*</b><select aria-label="申请类型" required disabled={Boolean(editingId)} className={field} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as BudgetDraftInput['kind'], targetType: event.target.value === 'exception' ? 'purchase_demand' : null, targetId: null })}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">预算部门 <b className="text-red-600">*</b><select aria-label="预算部门" required disabled={Boolean(editingId)} className={field} value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value, ...(form.targetType === 'department_order' ? { targetId: event.target.value } : {}) })}><option value="">请选择部门</option>{departments.data?.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">预算年度 <b className="text-red-600">*</b><input aria-label="申请预算年度" required pattern="[0-9]{4}" maxLength={4} disabled={Boolean(editingId)} className={field} value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} /></label>
          <label className="text-xs font-bold text-slate-600">{form.kind === 'exception' ? '本次总占用上限（元）' : '申请生效额度（元）'} <b className="text-red-600">*</b><input aria-label="申请额度" required type="number" min="0" max="99999999999999.99" step="0.01" className={field} value={Number.isNaN(form.targetAmount) ? '' : form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label>
          {form.kind === 'exception' && <><label className="text-xs font-bold text-slate-600">例外业务 <b className="text-red-600">*</b><select aria-label="例外业务类型" required disabled={Boolean(editingId)} className={field} value={form.targetType ?? ''} onChange={(event) => setForm({ ...form, targetType: event.target.value, targetId: event.target.value === 'department_order' ? form.departmentId : '' })}><option value="purchase_demand">采购需求</option><option value="rfq">采购项目下单</option><option value="department_order">单次无需求订单事务</option></select></label><label className="text-xs font-bold text-slate-600">关联业务编号 <b className="text-red-600">*</b><input aria-label="关联业务编号" required maxLength={200} disabled={Boolean(editingId) || form.targetType === 'department_order'} className={field} value={form.targetId ?? ''} onChange={(event) => setForm({ ...form, targetId: event.target.value })} /></label><p className="text-xs leading-5 text-amber-700 sm:col-span-2">例外不是追加预算。上限指本次操作后的部门年度总占用，批准后7天有效，仅限所关联业务的一次事务；调整预算后需重新申请。</p></>}
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">申请名称 <b className="text-red-600">*</b><input aria-label="申请名称" required maxLength={200} className={field} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">申请依据 <b className="text-red-600">*</b><textarea aria-label="申请依据" required maxLength={2000} className={field + ' h-28 py-2'} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
        </fieldset>
        {mutation.isError && <div className="mt-3"><FeedbackNotice tone="error" message={errorText(mutation.error)} /></div>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => setForm(null)}>取消</button><button type="submit" className={primary} disabled={busy}>{busy ? '保存中…' : '保存草稿'}</button></div>
      </form>
    </BudgetDialog>}
    {(withdraw || assignId) && <BudgetDialog title={withdraw ? '撤回预算申请' : '设置订单预算归属'} busy={busy} close={() => { setWithdraw(undefined); setAssignId(undefined); }}><form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); if (busy) return; run(withdraw ? { action: 'withdraw', id: withdraw, data: { reason } } : { action: 'assign', id: assignId!, data: { departmentId: assignDepartment, period: assignPeriod, reason } }, () => { setWithdraw(undefined); setAssignId(undefined); }); }}>
      {assignId && <><p className="break-all font-mono text-xs text-slate-500">{assignId}</p><label className="block text-xs font-bold">归属部门 *<select aria-label="归属部门" required className={field} value={assignDepartment} onChange={(event) => setAssignDepartment(event.target.value)}><option value="">请选择部门</option>{departments.data?.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-xs font-bold">归属年度 *<input required aria-label="归属年度" pattern="[0-9]{4}" maxLength={4} className={field} value={assignPeriod} onChange={(event) => setAssignPeriod(event.target.value)} /></label></>}
      <label className="block text-xs font-bold">原因 *<textarea aria-label="操作原因" required maxLength={1000} className={field + ' h-24 py-2'} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {mutation.isError && <FeedbackNotice tone="error" message={errorText(mutation.error)} />}<div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => { setWithdraw(undefined); setAssignId(undefined); }}>取消</button><button type="submit" className={primary} disabled={busy}>确认</button></div>
    </form></BudgetDialog>}
  </div>;
}

function PolicyEditor({ policy, busy, save }: { policy: BudgetControlPolicy; busy: boolean; save: (data: { mode: BudgetControlPolicy['mode']; revision: number; reason: string; acknowledged: boolean }) => void }) {
  const [mode, setMode] = useState(policy.mode); const [reason, setReason] = useState(''); const [acknowledged, setAcknowledged] = useState(false);
  return <form onSubmit={(event) => { event.preventDefault(); save({ mode, revision: policy.revision, reason, acknowledged }); }}>
    <fieldset disabled={!policy.canConfigure || busy}><legend className="text-base font-black">企业预算控制策略</legend>
      <div className="mt-4 flex flex-wrap gap-6">{Object.entries(modes).map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-bold"><input type="radio" name="budget-policy" value={value} checked={mode === value} onChange={() => { setMode(value as BudgetControlPolicy['mode']); setAcknowledged(false); }} />{label}</label>)}</div>
      <p className="mt-3 text-sm leading-6 text-slate-500">预警模式不阻断原业务；超额审批需有效例外；硬拦截需先增加生效预算。需求、采购项目及直采订单使用统一占用口径。</p>
      {policy.canConfigure && <><label className="mt-4 block text-xs font-bold">变更原因 *<textarea aria-label="策略变更原因" required maxLength={1000} className={field + ' h-20 py-2'} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        {mode !== 'warning' && <label className="mt-3 flex items-start gap-2 text-sm text-amber-800"><input className="mt-1" type="checkbox" required checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />确认启用强控制：可能阻止需求提交和订单生成，需先核对历史预算归属。</label>}
        <div className="mt-4 flex justify-end"><button type="submit" disabled={busy} className={primary}>{busy ? '保存中…' : '保存策略'}</button></div></>}
    </fieldset>
  </form>;
}
