import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Eye, RefreshCw, Send, Undo2 } from 'lucide-react';
import { qualificationReviews, qualificationAttempts, startQualificationWorkflow, cancelQualificationWorkflow, downloadReport,
  useWorkflowRuntimeTasks, useUnifiedWorkflowInstanceHistory, useUnifiedWorkflowCompleteTask } from '@24bid/api-client';
import { FeedbackNotice, FilterTabs, Pagination } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { WorkflowInstancePanel } from '../workflow/workflow-instance-panel';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { useAuthStore } from '../../lib/auth-store';

const labels = { pending: '待审批', approved: '已通过', rejected: '已退回', superseded: '已被新版替代' };
const button = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:opacity-40';
export function QualificationReviewPanel({ relationId }: { relationId?: string }) {
  const { can } = useBuyerPermissions(); const client = useQueryClient();
  const userId = useAuthStore(s => s.session?.userId);
  const query = useQuery({ queryKey: ['/buyer/suppliers/qualification-reviews'], queryFn: () => qualificationReviews('buyer') });
  const [tab, setTab] = useState('pending'); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null); const [attemptPage, setAttemptPage] = useState(1);
  const [chosen, setChosen] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState(''); const [comment, setComment] = useState(''); const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const all = query.isError ? [] : (query.data ?? []).filter(r => !relationId || r.relationId === relationId);
  const rows = all.filter(r => tab === 'pending' ? r.status === 'pending' : r.status !== 'pending');
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 6)));
  const review = all.find(r => r.id === selected);
  const attempts = useQuery({ queryKey: ['/buyer/suppliers/qualification-attempts', selected, attemptPage],
    queryFn: () => qualificationAttempts(selected!, attemptPage), enabled: selected !== null });
  const attempt = attempts.isError ? undefined : attempts.data?.items.find(a => a.id === chosen) ?? attempts.data?.items[0];
  const history = useUnifiedWorkflowInstanceHistory(can('buyer:workflow:read') || can('buyer:workflow:review') ? attempt?.workflowInstanceId : undefined);
  const tasks = useWorkflowRuntimeTasks(selected !== null && can('buyer:workflow:review'));
  const complete = useUnifiedWorkflowCompleteTask();
  const task = tasks.isError ? undefined : tasks.data?.data?.find(t => t.workflowInstanceId === attempt?.workflowInstanceId);
  const canHandle = can('buyer:workflow:review') && review?.status === 'pending' && attempt?.status === 'processing' && !history.isError && !history.isFetching
    && !tasks.isFetching && history.data?.data?.status === 'processing' && task?.taskId === history.data?.data?.currentTask?.taskId && Boolean(task);
  const working = busy || complete.isPending;
  const refresh = () => client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string'
    && (q.queryKey[0].includes('qualification') || q.queryKey[0].includes('/buyer/workflow/')) });
  const errorText = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败，请刷新后重试。';
  async function download(id: string) {
    if (!review) return;
    try { await downloadReport('/api/v1/buyer/suppliers/' + review.relationId + '/qualifications/' + id + '/download', '资质原件'); }
    catch { setMessage({ tone: 'error', text: '原件下载失败，请核验材料后再作审批结论。' }); }
  }
  async function start(formData: Record<string, unknown>) {
    if (!review || working) return;
    if (!reason.trim()) { setMessage({ tone: 'error', text: '请填写变更审核依据。' }); return; }
    setBusy(true); setMessage(null);
    try { const result = await startQualificationWorkflow(review.id, reason.trim(), formData); setChosen(result.id); setSubmitting(false); setReason(''); await refresh(); }
    catch (e) { setMessage({ tone: 'error', text: errorText(e) }); } finally { setBusy(false); }
  }
  async function cancelFlow() {
    if (!attempt || !comment.trim() || working) return;
    setBusy(true); setMessage(null);
    try { await cancelQualificationWorkflow(attempt.id, comment.trim()); setCancel(false); setComment(''); await refresh(); }
    catch (e) { setMessage({ tone: 'error', text: errorText(e) }); } finally { setBusy(false); }
  }
  const handle = (action: 'approve' | 'reject') => {
    if (!canHandle || !task || working) return;
    if (!comment.trim()) { setMessage({ tone: 'error', text: '请填写审核意见，驳回时说明需补充的材料。' }); return; }
    complete.mutate({ taskId: task.taskId, data: { action, comment: comment.trim() } }, {
      onSuccess: () => { setComment(''); setMessage({ tone: 'success', text: action === 'approve' ? '本节点已通过；全部节点通过后变更才生效。' : '已退回补件，供应商可查看意见。' }); void refresh(); },
    });
  };
  return <section aria-label="资质变更审批" className="mb-5 space-y-4 border-b border-slate-200 pb-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900">资质变更审批</h3>
      <button type="button" title="刷新复核" aria-label="刷新复核" disabled={query.isFetching || working} className={button} onClick={() => void refresh()}><RefreshCw size={15} /></button>
      {!selected && <FilterTabs value={tab} items={[{ id: 'pending', label: '待审批', count: all.filter(r => r.status === 'pending').length }, { id: 'history', label: '审批记录' }]} onChange={id => { setTab(id); setPage(1); }} />}
    </div>
    {message && <FeedbackNotice tone={message.tone} message={message.text} />}
    {complete.isError && <FeedbackNotice tone="error" message={errorText(complete.error)} />}
    {query.isError ? <FeedbackNotice tone="error" message="复核记录加载失败，请刷新重试。" /> : query.isLoading ? <p>正在加载复核记录…</p> : selected ? !review ? <FeedbackNotice tone="error" message="该复核不在当前可见范围。" /> : <>
      <button type="button" className={button} disabled={working} onClick={() => { setSelected(null); setChosen(null); setComment(''); setCancel(false); }}><ArrowLeft size={14} />返回变更列表</button>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-bold">{review.supplierName} · {review.qualificationType}</h4><p className="mt-1 text-xs text-slate-500">{labels[review.status]}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => void download(review.previousId)}><Download size={14} />旧版原件</button><button type="button" className={button} onClick={() => void download(review.qualificationId)}><Download size={14} />新版原件</button></div>
      </div>
      {review.comment && <p className="whitespace-pre-wrap break-words text-sm">复核意见：{review.comment} · {review.actorId} · {review.reviewedAt && new Date(review.reviewedAt).toLocaleString('zh-CN')}</p>}
      {attempts.isError ? <FeedbackNotice tone="error" message="审批历史读取失败，请刷新后重试。" /> : attempts.isLoading ? <p>正在读取审批历史…</p> : <>
        <div className="flex flex-wrap gap-2">{attempts.data?.items.map((a, i) => <button key={a.id} type="button" className={button + (a.id === attempt?.id ? ' border-blue-400 text-blue-700' : '')} onClick={() => { setChosen(a.id); setComment(''); }}>第 {(attemptPage - 1) * 10 + i + 1} 条 · {a.status === 'processing' ? '审批中' : a.status === 'cancelled' ? '已取消' : '已结束'}</button>)}</div>
        {!!attempts.data?.total && <Pagination page={attemptPage} pageSize={10} total={attempts.data.total} onPageChange={p => { setAttemptPage(p); setChosen(null); }} />}
        {review.status === 'pending' && can('buyer:supplier:manage') && !attempts.data?.items.some(a => a.status === 'processing') && attemptPage === 1 && <button type="button" className={button} disabled={working} onClick={() => { setSubmitting(true); setReason(''); setMessage(null); }}><Send size={14} />发起变更审批</button>}
        {attempt?.workflowInstanceId && (history.isError ? <FeedbackNotice tone="error" message="流程详情加载失败或无权查看。" /> : history.data?.data ? <WorkflowInstancePanel history={history.data.data} /> : <p>正在加载审批进度…</p>)}
        {canHandle && <div className="space-y-3 border-t border-slate-100 pt-4"><label className="block text-sm font-bold">审核意见 *<textarea aria-label="资质审核意见" maxLength={2000} disabled={working} className="mt-2 min-h-24 w-full rounded-md border border-slate-200 p-3 font-normal" value={comment} onChange={e => setComment(e.target.value)} /></label>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={working} onClick={() => handle('reject')}>退回补件</button><button type="button" className={button} disabled={working} onClick={() => handle('approve')}>通过本节点</button></div></div>}
        {review.status === 'pending' && attempt?.status === 'processing' && !canHandle && <p className="text-sm text-slate-500">等待当前节点办理人处理。请在流程历史中查看当前节点及候选人。</p>}
        {attempt?.status === 'processing' && can('buyer:supplier:manage') && (attempt.createdBy === userId || can('buyer:workflow:manage')) && <button type="button" className={button} disabled={working} onClick={() => { setCancel(!cancel); setComment(''); }}><Undo2 size={14} />取消本次流程</button>}
        {cancel && <form className="space-y-2" onSubmit={e => { e.preventDefault(); void cancelFlow(); }}><label className="block text-sm">取消原因 *<textarea aria-label="取消流程原因" required maxLength={1000} className="mt-1 w-full rounded-md border border-slate-200 p-3" value={comment} onChange={e => setComment(e.target.value)} /></label><button type="submit" className={button} disabled={working}>确认取消</button></form>}
      </>}
    </> : rows.length === 0 ? <p className="text-sm text-slate-500">暂无{tab === 'pending' ? '待审批资质' : '复核记录'}</p> : <>
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['供应商 / 资质', '状态', '提交时间', '操作'].map(h => <th className="px-3 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.slice((currentPage - 1) * 6, currentPage * 6).map(r => <tr key={r.id}><td className="px-3 py-3 font-bold">{r.supplierName}<p className="mt-1 text-xs font-normal text-slate-500">{r.qualificationType}</p></td><td className="whitespace-nowrap px-3 py-3">{labels[r.status]}</td><td className="whitespace-nowrap px-3 py-3 text-xs">{new Date(r.createdAt).toLocaleString('zh-CN')}</td><td className="px-3 py-3"><button type="button" className={button} onClick={() => { setSelected(r.id); setChosen(null); setAttemptPage(1); setMessage(null); setComment(''); }}><Eye size={14} />详情</button></td></tr>)}</tbody></table></div>
      <Pagination page={currentPage} pageSize={6} total={rows.length} onPageChange={setPage} />
    </>}
    {submitting && review && can('buyer:supplier:manage') && <WorkflowSubmitDialog businessType="supplier_qualification_change" title={review.qualificationType + '变更审批'} busy={working} onClose={() => setSubmitting(false)} onSubmit={data => void start(data)}>
      <label className="block text-sm font-bold">变更审核依据 *<textarea aria-label="变更审核依据" required maxLength={2000} className="mt-2 min-h-24 w-full rounded-md border border-slate-200 p-3 font-normal" value={reason} onChange={e => setReason(e.target.value)} /></label>
      {message?.tone === 'error' && <FeedbackNotice tone="error" message={message.text} />}
    </WorkflowSubmitDialog>}
  </section>;
}
