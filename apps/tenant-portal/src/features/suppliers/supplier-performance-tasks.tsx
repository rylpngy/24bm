import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, X } from 'lucide-react';
import {
  listPerformanceAssignees,
  requestPerformanceRemediation, reviewPerformanceTask,
  usePerformanceEvidence,
} from '@24bid/api-client';
import { type PerformanceTask, type PerformanceTaskDraft, type PerformanceTaskEvaluation, listBuyerPerformanceTasks, createPerformanceTask, evaluatePerformanceTask, useEvaluationTemplates, legacyScoring, scoringDescription, evaluationDimensions, calculateEvaluationTotal } from '@24bid/api-client/supplier-evaluation-templates';
import { EvidencePanel, FeedbackNotice, Pagination, StatusPill } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { useAuthStore } from '../../lib/auth-store';

const inputClass = 'mt-1 w-full min-w-0 rounded-md border border-slate-200 bg-white p-2 text-sm font-normal';
const buttonClass = 'inline-flex min-h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-3 text-sm font-bold text-blue-700 disabled:opacity-50';
const statusNames: Record<string, string> = { assigned: '待考核', evaluated: '已考核', remediation_requested: '待整改', remediation_submitted: '待复核', closed: '已关闭' };
const actionNames: Record<string, string> = { created: '创建任务', assigned: '分派任务', evaluated: '完成考核', remediation_requested: '发起整改', remediation_submitted: '提交整改', remediation_rejected: '退回整改', review_approved: '复核通过', review_rejected: '退回整改', closed: '关闭' };
const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败，填写内容已保留，请重试。';

function TaskDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; container.current?.focus(); return () => previous?.focus(); }, []);
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
    <div ref={container} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
      className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) onClose();
        if (event.key !== 'Tab') return;
        const nodes = container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
        if (!nodes?.length) { event.preventDefault(); return; }
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first.focus(); }
      }}>
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-black">{title}</h3>
        <button type="button" title="关闭" aria-label="关闭任务弹窗" disabled={busy} className="shrink-0 p-2" onClick={onClose}><X size={18} /></button></div>
      {children}
    </div>
  </div>, document.body);
}

export function SupplierPerformanceTasks({ relationId }: { relationId: string }) {
  const { can } = useBuyerPermissions();
  const canRead = can('buyer:supplier:read'), canManage = can('buyer:supplier:manage');
  const userId = useAuthStore(s => s.session?.userId);
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: [`/api/v1/buyer/suppliers/${relationId}/performance-tasks`], queryFn: ({ signal }) => listBuyerPerformanceTasks(relationId, signal), enabled: canRead });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const all = tasks.data?.data ?? [];
  const current = all.find(t => t.id === selected);
  const safePage = Math.min(page, Math.max(1, Math.ceil(all.length / 8)));
  const refresh = (updated?: PerformanceTask) => {
    if (updated) client.setQueryData<{ data?: PerformanceTask[] }>([`/api/v1/buyer/suppliers/${relationId}/performance-tasks`], old => old ? { ...old, data: old.data?.map(task => task.id === updated.id ? { ...task, ...updated } : task) } : old);
    return client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('/buyer/suppliers') });
  };
  const complete = () => { setCreating(false); setNotice('操作已保存。'); };
  if (!canRead) return null;
  return <section data-testid="buyer-performance-tasks" className="mb-5 border-b border-slate-200 pb-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black text-slate-900">考核任务</h2>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={tasks.isFetching} onClick={() => void refresh()}><RefreshCw size={15} />刷新任务</button>
        {canManage && <button type="button" className={buttonClass} onClick={() => { setNotice(''); setCreating(true); }}><Plus size={16} />新建考核任务</button>}</div></div>
    {notice && <FeedbackNotice tone="success" message={notice} />}
    {tasks.isPending ? <FeedbackNotice tone="info" message="正在加载考核任务…" /> : tasks.isError ? <div role="alert"><FeedbackNotice tone="error" message="考核任务加载失败。" /><button type="button" className={buttonClass} onClick={() => void tasks.refetch()}>重试</button></div> : all.length === 0 ? <p className="py-4 text-sm text-slate-500">暂无考核任务</p> : <>
      <div className="divide-y divide-slate-100">{all.slice((safePage - 1) * 8, safePage * 8).map(task => <div key={task.id} data-task-id={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 break-words"><p className="text-sm font-bold">{task.period} · {task.assigneeName}</p><p className="mt-1 text-xs text-slate-500">截止 {task.dueDate}{task.totalScore != null ? ` · ${task.totalScore}分` : ''}</p></div>
        <div className="flex shrink-0 items-center gap-2"><StatusPill label={statusNames[task.status] ?? task.status} /><button type="button" className={buttonClass} onClick={() => { setNotice(''); setSelected(task.id); }}>查看任务</button></div>
      </div>)}</div><Pagination page={safePage} pageSize={8} total={all.length} onPageChange={setPage} />
    </>}
    {creating && canManage && <CreateTaskDialog relationId={relationId} onClose={() => setCreating(false)} refresh={refresh} onComplete={complete} />}
    {current && <TaskDetail key={`${current.id}:${current.status}`} task={current} canManage={canManage} refreshing={tasks.isFetching} refreshError={tasks.isError} notice={notice} userId={userId} onClose={() => setSelected(undefined)} refresh={refresh} onComplete={complete} />}
  </section>;
}

function CreateTaskDialog({ relationId, onClose, refresh, onComplete }: { relationId: string; onClose: () => void; refresh: () => Promise<unknown>; onComplete: () => void }) {
  const templates = useEvaluationTemplates();
  const availableTemplates = (templates.data?.data ?? []).filter(t => t.enabled);
  const [draft, setDraft] = useState<PerformanceTaskDraft>(() => ({ period: `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`, assigneeId: '', dueDate: '' }));
  const assignees = useQuery({ queryKey: [`/api/v1/buyer/suppliers/${relationId}/performance-assignees`], queryFn: ({ signal }) => listPerformanceAssignees(relationId, signal) });
  const lock = useRef(false);
  const create = useMutation({ mutationFn: () => createPerformanceTask(relationId, { ...draft, period: draft.period.trim() }), onSuccess: async () => { await refresh(); onComplete(); }, onSettled: () => { lock.current = false; } });
  const valid = !templates.isPending && !templates.isError && (!draft.templateVersionId || availableTemplates.some(t => t.id === draft.templateVersionId)) && /^(\d{4}|\d{4}-(Q[1-4]|0[1-9]|1[0-2]))$/.test(draft.period.trim()) && !!draft.dueDate && !assignees.isError && (assignees.data?.data ?? []).some(a => a.id === draft.assigneeId);
  return <TaskDialog title="新建考核任务" busy={create.isPending} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (!valid || lock.current || create.isPending) return; lock.current = true; create.mutate(); }} className="space-y-4">
      <fieldset disabled={create.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">任务周期 *<input aria-label="任务周期" required value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value })} className={inputClass} /></label>
        <label className="text-sm font-bold">考核人 *<select aria-label="考核人" required value={draft.assigneeId} onChange={e => setDraft({ ...draft, assigneeId: e.target.value })} className={inputClass}><option value="">请选择</option>{(assignees.data?.data ?? []).map(a => <option key={a.id} value={a.id}>{a.displayName}</option>)}</select></label>
        <label className="text-sm font-bold">考核截止日期 *<input aria-label="考核截止日期" type="date" required value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} className={inputClass} /></label>
        <label className="min-w-0 text-sm font-bold">考核模板<select aria-label="任务考核模板" value={draft.templateVersionId ?? ''} disabled={templates.isPending || templates.isError} onChange={e => setDraft({ ...draft, templateVersionId: e.target.value || undefined })} className={inputClass}><option value="">默认模板 · v0</option>{availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name} · v{t.version}</option>)}{draft.templateVersionId && !availableTemplates.some(t => t.id === draft.templateVersionId) && <option value={draft.templateVersionId}>所选模板已不可用</option>}</select></label>
      </fieldset>
      {templates.isError && <div role="alert"><FeedbackNotice tone="error" message="模板加载失败。" /><button type="button" className={buttonClass} onClick={() => void templates.refetch()}>重试模板</button></div>}
      {assignees.isError && <div role="alert"><FeedbackNotice tone="error" message="考核人加载失败。" /><button type="button" className={buttonClass} onClick={() => void assignees.refetch()}>重试</button></div>}
      {create.isError && <div role="alert"><FeedbackNotice tone="error" message={errorMessage(create.error)} /></div>}
      <button type="submit" disabled={!valid || create.isPending} className={buttonClass}>{create.isPending ? '创建中…' : '创建任务'}</button>
    </form>
  </TaskDialog>;
}

function TaskDetail({ task, canManage, refreshing, refreshError, notice, userId, onClose, refresh, onComplete }: { task: PerformanceTask; canManage: boolean; refreshing: boolean; refreshError: boolean; notice: string; userId?: string; onClose: () => void; refresh: (updated?: PerformanceTask) => Promise<unknown>; onComplete: () => void }) {
  const scoring = task.scoring ?? legacyScoring;
  const evidence = usePerformanceEvidence(task.id, task.version, task.relationId);
  // A refetch must not attach an existing draft to a newer remediation round.
  const [expectedVersion] = useState(task.version);
  const staleDraft = expectedVersion !== task.version;
  const [scores, setScores] = useState({ qualityScore: '', deliveryScore: '', priceScore: '', serviceScore: '' });
  const [comment, setComment] = useState('');
  const [requirement, setRequirement] = useState('');
  const [dueDate, setDueDate] = useState('');
  const lock = useRef(false);
  const evaluate = canManage && !!userId && task.assigneeId === userId && task.status === 'assigned';
  const request = canManage && task.status === 'evaluated';
  const review = canManage && task.status === 'remediation_submitted';
  const validScores = Object.values(scores).every(value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100);
  const mutation = useMutation({ mutationFn: async (action: 'evaluate' | 'request' | 'approve' | 'reject') => {
    if (action === 'evaluate') {
      const data: PerformanceTaskEvaluation = { qualityScore: Number(scores.qualityScore), deliveryScore: Number(scores.deliveryScore), priceScore: Number(scores.priceScore), serviceScore: Number(scores.serviceScore), comment: comment.trim() };
      return evaluatePerformanceTask(task.relationId, task.id, data);
    }
    if (action === 'request') return requestPerformanceRemediation(task.relationId, task.id, { requirement: requirement.trim(), dueDate });
    return reviewPerformanceTask(task.relationId, task.id, { approved: action === 'approve', comment: comment.trim(), expectedVersion });
  }, onSuccess: async result => { await refresh(result.data); onComplete(); }, onSettled: () => { lock.current = false; } });
  const submitDisabled = refreshing || refreshError || mutation.isPending || staleDraft;
  const submit = (action: 'evaluate' | 'request' | 'approve' | 'reject') => {
    const valid = action === 'evaluate' ? evaluate && validScores && !!comment.trim() : action === 'request' ? request && !!requirement.trim() && !!dueDate : review && !!comment.trim();
    if (!valid || lock.current || submitDisabled) return;
    lock.current = true; mutation.mutate(action);
  };
  return <TaskDialog title="考核任务详情" busy={mutation.isPending} onClose={onClose}>
    <button type="button" aria-label="刷新当前任务" disabled={refreshing || mutation.isPending} className={`${buttonClass} mb-3`} onClick={() => void refresh()}><RefreshCw size={15} />刷新任务</button>
    {refreshError && <div role="alert" className="mb-3"><FeedbackNotice tone="error" message="任务刷新失败，请重试。" /></div>}
    {staleDraft && <div role="alert" className="mb-3"><FeedbackNotice tone="error" message="任务已更新，草稿已保留，请重新打开任务后提交。" /></div>}
    {notice && <div className="mb-3"><FeedbackNotice tone="success" message={notice} /></div>}
    <div className="flex flex-wrap items-center gap-3 text-sm"><strong>{task.period}</strong><StatusPill label={statusNames[task.status] ?? task.status} /><span>{task.assigneeName}</span><span>截止 {task.dueDate}</span>{task.totalScore != null && <span>{task.totalScore}分</span>}</div>
    <p className="mt-2 break-words text-xs text-slate-500">{scoringDescription(scoring)}</p>
    {task.requirement && <div className="mt-4"><h4 className="text-sm font-bold">整改要求</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{task.requirement}</p></div>}
    {task.response && <div className="mt-4"><h4 className="text-sm font-bold">整改反馈</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{task.response}</p></div>}
    <fieldset disabled={mutation.isPending} className="mt-4 min-w-0 space-y-3">
      {evaluate && <><div className="grid gap-3 sm:grid-cols-2">{evaluationDimensions.map(({ key, weight, label }) => <label key={key} className="text-sm font-bold">{label}评分（权重 {scoring[weight]}%） *<input aria-label={`${label}评分`} type="number" min={0} max={100} step="0.01" required value={scores[key]} onChange={e => setScores({ ...scores, [key]: e.target.value })} className={inputClass} /></label>)}</div>
        <p className="text-sm font-bold">综合分(实时)：{validScores ? calculateEvaluationTotal(scores, scoring).toFixed(2) : '—'}</p>
        <label className="block text-sm font-bold">任务考核依据 *<textarea aria-label="任务考核依据" required maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} className={`${inputClass} min-h-24`} /></label>
        <button type="button" disabled={!validScores || !comment.trim() || submitDisabled} className={buttonClass} onClick={() => submit('evaluate')}>提交任务考核</button></>}
      {request && <><label className="block text-sm font-bold">整改要求 *<textarea aria-label="整改要求" required maxLength={2000} value={requirement} onChange={e => setRequirement(e.target.value)} className={`${inputClass} min-h-24`} /></label>
        <label className="block text-sm font-bold">整改截止日期 *<input aria-label="整改截止日期" type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} /></label>
        <button type="button" disabled={!requirement.trim() || !dueDate || submitDisabled} className={buttonClass} onClick={() => submit('request')}>发起整改</button></>}
      {review && <><label className="block text-sm font-bold">复核意见 *<textarea aria-label="复核意见" required maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} className={`${inputClass} min-h-24`} /></label>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!comment.trim() || submitDisabled} className={buttonClass} onClick={() => submit('approve')}>通过并关闭</button><button type="button" disabled={!comment.trim() || submitDisabled} className={buttonClass} onClick={() => submit('reject')}>退回整改</button></div></>}
    </fieldset>
    {mutation.isPending && <FeedbackNotice tone="info" message="正在保存…" />}
    {mutation.isError && <div role="alert"><FeedbackNotice tone="error" message={errorMessage(mutation.error)} /></div>}
    <h4 className="mt-5 border-t border-slate-200 pt-4 text-sm font-bold">任务历史</h4>
    <ol className="mt-2 space-y-3">{task.history.map((event, index) => <li key={index} className="break-words text-sm"><p className="text-xs text-slate-500">{event.createdAt} · {event.actorName} · {actionNames[event.action] ?? event.action}</p><p className="mt-1 whitespace-pre-wrap">{event.comment}</p></li>)}</ol>
    <EvidencePanel {...evidence} />
  </TaskDialog>;
}
