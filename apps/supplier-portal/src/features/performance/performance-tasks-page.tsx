import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { type PerformanceTask, listSupplierPerformanceTasks, respondPerformanceTask, usePerformanceEvidence } from '@24bid/api-client';
import { EvidencePanel, FeedbackNotice, Pagination, Panel, StatusPill } from '@24bid/ui';

const buttonClass = 'inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 px-3 text-sm font-bold text-blue-700 disabled:opacity-50';
const statusNames: Record<string, string> = { assigned: '待考核', evaluated: '已考核', remediation_requested: '待整改', remediation_submitted: '待复核', closed: '已关闭' };
const actionNames: Record<string, string> = { created: '创建任务', assigned: '分派任务', evaluated: '完成考核', remediation_requested: '发起整改', remediation_submitted: '提交整改', remediation_rejected: '退回整改', review_approved: '复核通过', review_rejected: '退回整改', closed: '关闭' };
const queryKey = ['/api/v1/supplier/performance-tasks'];

export function PerformanceTasksPage({ canManage = false, canRead = true }: { canManage?: boolean; canRead?: boolean }) {
  const client = useQueryClient();
  const tasks = useQuery({ queryKey, queryFn: ({ signal }) => listSupplierPerformanceTasks(signal), enabled: canRead });
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const pendingChanged = (pending: boolean) => { submissionLock.current = pending; setSubmitting(pending); };
  const all = tasks.data?.data ?? [];
  const current = all.find(t => t.id === selected);
  const safePage = Math.min(page, Math.max(1, Math.ceil(all.length / 8)));
  const refresh = (updated?: PerformanceTask) => {
    if (updated) client.setQueryData<{ data?: PerformanceTask[] }>(queryKey, old => old ? { ...old, data: old.data?.map(task => task.id === updated.id ? { ...task, ...updated } : task) } : old);
    return client.invalidateQueries({ queryKey });
  };
  if (!canRead) return null;
  return <Panel title="整改反馈" icon={ClipboardCheck} subtitle="">
    <section data-testid="supplier-performance-tasks">
      <div className="mb-3 flex justify-end"><button type="button" className={buttonClass} disabled={tasks.isFetching || submitting} onClick={() => { if (!submissionLock.current) void refresh(); }}><RefreshCw size={15} className="mr-1" />刷新任务</button></div>
      {notice && <FeedbackNotice tone="success" message={notice} />}
      {tasks.isPending ? <FeedbackNotice tone="info" message="正在加载整改任务…" /> : tasks.isError ? <div role="alert"><FeedbackNotice tone="error" message="整改任务加载失败。" /><button type="button" className={buttonClass} onClick={() => void tasks.refetch()}>重试</button></div> : all.length === 0 ? <p className="py-6 text-sm text-slate-500">暂无整改任务</p> : <>
        <div className="divide-y divide-slate-100">{all.slice((safePage - 1) * 8, safePage * 8).map(task => <div key={task.id} data-task-id={task.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 break-words"><p className="text-sm font-bold">{task.buyerName}</p><p className="mt-1 text-xs text-slate-500">{task.period} · 截止 {task.dueDate}</p></div>
          <div className="flex shrink-0 items-center gap-2"><StatusPill label={statusNames[task.status] ?? task.status} /><button type="button" className={buttonClass} disabled={submitting} aria-expanded={selected === task.id} onClick={() => { if (submissionLock.current) return; setNotice(''); setSelected(selected === task.id ? undefined : task.id); }}>查看整改</button></div>
        </div>)}</div><Pagination page={safePage} pageSize={8} total={all.length} onPageChange={nextPage => { if (!submissionLock.current) setPage(nextPage); }} />
      </>}
      {current && <ResponseDetail key={`${current.id}:${current.status}`} task={current} canManage={canManage} refreshing={tasks.isFetching} refreshError={tasks.isError} refresh={refresh} onPendingChange={pendingChanged} onComplete={() => setNotice('整改反馈已提交。')} />}
    </section>
  </Panel>;
}

function ResponseDetail({ task, canManage, refreshing, refreshError, refresh, onPendingChange, onComplete }: { task: PerformanceTask; canManage: boolean; refreshing: boolean; refreshError: boolean; refresh: (updated?: PerformanceTask) => Promise<unknown>; onPendingChange: (pending: boolean) => void; onComplete: () => void }) {
  // Keep the concurrency token tied to the round that opened this draft.
  const [expectedVersion] = useState(task.version);
  const evidence = usePerformanceEvidence(task.id, expectedVersion);
  const staleDraft = expectedVersion !== task.version;
  const [response, setResponse] = useState('');
  const lock = useRef(false);
  const canRespond = canManage && task.status === 'remediation_requested';
  const mutation = useMutation({ mutationFn: () => respondPerformanceTask(task.id, { response: response.trim(), expectedVersion }),
    onSuccess: async result => { await refresh(result.data); onComplete(); }, onSettled: () => { lock.current = false; onPendingChange(false); } });
  const submitDisabled = refreshing || refreshError || mutation.isPending || staleDraft || evidence.busy;
  useEffect(() => { onPendingChange(evidence.busy || mutation.isPending); }, [evidence.busy, mutation.isPending]);
  return <section aria-label="整改任务详情" className="mt-5 border-t border-slate-200 pt-5">
    <h2 className="break-words text-base font-bold">{task.buyerName} · {task.period}</h2>
    {staleDraft && <div role="alert" className="mt-3"><FeedbackNotice tone="error" message="任务已更新，草稿已保留，请重新打开任务后提交。" /></div>}
    {task.requirement && <div className="mt-4"><h3 className="text-sm font-bold">整改要求</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{task.requirement}</p></div>}
    {task.response && <div className="mt-4"><h3 className="text-sm font-bold">已提交反馈</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{task.response}</p></div>}
    {canRespond && <form className="mt-4" onSubmit={event => { event.preventDefault(); if (!canRespond || !response.trim() || lock.current || submitDisabled) return; lock.current = true; onPendingChange(true); mutation.mutate(); }}>
      <label className="block text-sm font-bold">整改反馈内容 *<textarea aria-label="整改反馈内容" required maxLength={2000} disabled={mutation.isPending} value={response} onChange={e => setResponse(e.target.value)} className="mt-2 min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm font-normal" /></label>
      <button type="submit" disabled={!response.trim() || submitDisabled} className={`${buttonClass} mt-3`}>{mutation.isPending ? '提交中…' : '提交整改反馈'}</button>
    </form>}
    {mutation.isError && <div role="alert" className="mt-3"><FeedbackNotice tone="error" message={(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '提交失败，填写内容已保留，请重试。'} /></div>}
    <EvidencePanel {...evidence} canUpload={canRespond && !refreshing && !refreshError && !staleDraft && !mutation.isPending} />
    <h3 className="mt-5 text-sm font-bold">任务历史</h3>
    <ol className="mt-2 space-y-3">{task.history.map((event, index) => <li key={index} className="break-words text-sm"><p className="text-xs text-slate-500">{event.createdAt} · {event.actorName} · {actionNames[event.action] ?? event.action}</p><p className="mt-1 whitespace-pre-wrap">{event.comment}</p></li>)}</ol>
  </section>;
}
