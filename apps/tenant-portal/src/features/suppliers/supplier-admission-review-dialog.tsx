import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { type WorkflowTask, useUnifiedWorkflowCompleteTask, useUnifiedWorkflowInstanceHistory } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { WorkflowInstancePanel } from '../workflow/workflow-instance-panel';
import { SupplierQualificationsTab } from './supplier-qualifications-tab';

export function SupplierAdmissionReviewDialog({ task, approved, onClose, onComplete }: {
  task: WorkflowTask;
  approved: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const history = useUnifiedWorkflowInstanceHistory(task.workflowInstanceId);
  const complete = useUnifiedWorkflowCompleteTask();
  const [comment, setComment] = useState('');
  const [validation, setValidation] = useState('');
  const submitting = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const current = history.data?.data;
  const exit = task.businessType === 'buyer_supplier_exit';
  const canSubmit = !history.isLoading && !history.isError && current?.status === 'processing'
    && current.currentTask?.taskId === task.taskId;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    container.current?.focus();
    return () => previous?.focus();
  }, []);
  const refresh = () => queryClient.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string'
    && (/\/buyer\/(workflow|suppliers)/).test(q.queryKey[0]) });
  const submit = () => {
    if (submitting.current || !canSubmit) return;
    if (!comment.trim()) { setValidation(approved ? '请填写审核意见。' : '请填写驳回原因及需要补充的资料。'); return; }
    submitting.current = true;
    setValidation('');
    complete.mutate({ taskId: task.taskId, data: { action: approved ? 'approve' : 'reject', comment: comment.trim() } }, {
      onSuccess: response => {
        void refresh();
        onComplete(response.data?.status === 'processing' ? '当前节点已完成，已转交下一办理人。'
          : approved ? (exit ? '供应商退出审批已通过。' : '供应商准入审批已通过。') : '已驳回，申请人可调整后重新提交。');
      },
      onError: () => { void refresh(); },
      onSettled: () => { submitting.current = false; },
    });
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div ref={container} tabIndex={-1} role="dialog" aria-modal="true" aria-label={exit ? '供应商退出审核' : '供应商准入审核'}
        className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-5 shadow-xl"
        onKeyDown={event => {
          if (event.key === 'Escape' && !complete.isPending) onClose();
          if (event.key !== 'Tab') return;
          const nodes = container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, a[href]');
          if (!nodes?.length) return;
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">{approved ? '审核通过' : '驳回补件'} · {task.taskName}</h2>
          <button type="button" aria-label="关闭审核" disabled={complete.isPending} onClick={onClose} className="shrink-0 rounded-md p-2 text-slate-500"><X size={18} /></button>
        </div>
        {history.isLoading ? <FeedbackNotice tone="info" message="正在加载申请资料…" /> : history.isError ? (
          <div role="alert"><FeedbackNotice tone="error" message="申请资料加载失败，暂不能审批。" /><button type="button" onClick={() => void history.refetch()} className="mt-2 text-sm font-bold text-blue-600">重试</button></div>
        ) : current ? <WorkflowInstancePanel history={current} /> : <FeedbackNotice tone="error" message="未找到申请资料。" />}
        {current && !history.isError && !exit && <div className="mt-4"><SupplierQualificationsTab relationId={task.businessId} /></div>}
        {!history.isLoading && !history.isError && !canSubmit && <div className="mt-3"><FeedbackNotice tone="error" message="流程节点已变化，请关闭后刷新待办。" /></div>}
        <label className="mt-4 block text-sm font-bold text-slate-700">
          {approved ? '审核意见' : '驳回原因及补件要求'} <span className="text-red-600">*</span>
          <textarea value={comment} onChange={event => { setComment(event.target.value); setValidation(''); }} disabled={complete.isPending}
            maxLength={2000} className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3 font-normal" />
        </label>
        {validation && <p role="alert" className="mt-2 text-sm text-red-700">{validation}</p>}
        {complete.isError && <div role="alert" className="mt-2"><FeedbackNotice tone="error" message={(complete.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '审核失败，意见已保留，请重试。'} /></div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={complete.isPending} onClick={onClose} className="h-9 whitespace-nowrap rounded-md border border-slate-200 px-4 text-sm font-bold">取消</button>
          <button type="button" disabled={!canSubmit || complete.isPending} onClick={submit}
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm font-bold text-white disabled:bg-slate-400 ${approved ? 'bg-blue-600' : 'bg-red-600'}`}>
            {complete.isPending ? '提交中…' : approved ? '确认通过' : '确认驳回'}
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
