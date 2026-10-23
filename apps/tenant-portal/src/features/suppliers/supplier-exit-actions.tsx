import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { supplierExitSubmitExit, buyerSupplierExitRisk, useWorkflowRuntimeTasks, type WorkflowTask, type SubmitSupplierExitRequest } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { SupplierAdmissionReviewDialog } from './supplier-admission-review-dialog';

export function SupplierExitActions({ id, status }: { id: string; status?: string }) {
  const { can } = useBuyerPermissions();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<{ task: WorkflowTask; approved: boolean } | null>(null);
  const tasks = useWorkflowRuntimeTasks(status === '退出审批中' && can('buyer:workflow:review'));
  const task = tasks.data?.data?.find(t => t.businessType === 'buyer_supplier_exit' && t.businessId === id);
  const refresh = () => client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string'
    && /\/buyer\/(suppliers|workflow)/.test(q.queryKey[0]) });
  // Java Map<String,Object> permits scalar form values; the generated index type is narrower.
  const submit = useMutation({ mutationFn: (formData: Record<string, unknown>) => supplierExitSubmitExit(id, { reason, formData: formData as SubmitSupplierExitRequest['formData'] }),
    onSuccess: () => { setOpen(false); setReason(''); void refresh(); } });
  const prepare = async () => {
    setLoading(true); setMessage('');
    try {
      const { data } = await buyerSupplierExitRisk(id);
      if (!data) throw new Error();
      if (data.unreceivedOrderCount || data.unpaidInvoiceCount) {
        setMessage(`暂不能退出：未收货订单 ${data.unreceivedOrderCount} 笔，未付清发票 ${data.unpaidInvoiceCount} 张。请先处理未结业务。`);
      } else { submit.reset(); setOpen(true); }
    } catch { setMessage('未结业务核查失败，请刷新后重试。'); }
    finally { setLoading(false); }
  };
  if (status !== '已准入' && status !== '退出审批中') return null;
  return <section className="space-y-3 pb-3">
    {message && <FeedbackNotice tone="info" message={message} />}
    {status === '已准入' && can('buyer:supplier:manage') && <button type="button" disabled={loading}
      onClick={() => void prepare()} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50">
      <LogOut size={16} />{loading ? '核查未结业务…' : '申请退出'}
    </button>}
    {status === '退出审批中' && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      <span>{tasks.isError ? '审批任务加载失败，请刷新重试。' : task ? '当前退出审批由您办理。' : '退出审批中，暂停新增订单。请展开审批信息查看办理进度。'}</span>
      {task && !tasks.isError && can('buyer:workflow:review') && <>
        <button type="button" className="h-10 whitespace-nowrap rounded-lg bg-blue-600 px-4 font-bold text-white" onClick={() => setReview({ task, approved: true })}>通过退出</button>
        <button type="button" className="h-10 whitespace-nowrap rounded-lg border border-red-200 px-4 font-bold text-red-600" onClick={() => setReview({ task, approved: false })}>驳回退出</button>
      </>}
    </div>}
    {open && createPortal(<WorkflowSubmitDialog businessType="buyer_supplier_exit" title="供应商退出" busy={submit.isPending}
      submissionError={submit.error} onClose={() => setOpen(false)} onSubmit={data => {
        if (!reason.trim()) { setMessage('请填写退出原因。'); return; }
        setMessage(''); submit.mutate(data);
      }}>
      <label className="block text-sm font-bold text-slate-700">退出原因 <span className="text-red-600">*</span>
        <textarea aria-label="退出原因" required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)}
          className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3" />
      </label>
      {!reason.trim() && <p className="text-sm text-amber-700">请填写退出原因后提交；提交后暂停新订单，通过后保留历史业务。</p>}
    </WorkflowSubmitDialog>, document.body)}
    {review && <SupplierAdmissionReviewDialog {...review} onClose={() => setReview(null)} onComplete={text => {
      setReview(null); setMessage(text); void refresh();
    }} />}
  </section>;
}
