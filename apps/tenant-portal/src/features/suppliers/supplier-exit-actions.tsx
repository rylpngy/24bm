import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { supplierExitSubmitExit, getSupplierExitRisk, isSupplierExitRisk, isSupplierExitBlocked, useWorkflowRuntimeTasks, type SupplierExitRisk, type WorkflowTask, type SubmitSupplierExitRequest } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { SupplierAdmissionReviewDialog } from './supplier-admission-review-dialog';
import { SupplierUnsettledBusiness } from './supplier-unsettled-business';

export function SupplierExitActions({ id, status, supplierId }: { id: string; status?: string; supplierId?: string }) {
  const { can } = useBuyerPermissions();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<{ relationId: string; risk: SupplierExitRisk } | null>(null);
  const risk = checked?.relationId === id ? checked.risk : null;
  const pending = useRef(false);
  const context = useRef({ id, status, manage: can('buyer:supplier:manage') });
  context.current = { id, status, manage: can('buyer:supplier:manage') };
  const canSubmit = status === '已准入' && can('buyer:supplier:manage') && !!risk && !isSupplierExitBlocked(risk) && !loading;
  const [review, setReview] = useState<{ task: WorkflowTask; approved: boolean } | null>(null);
  const tasks = useWorkflowRuntimeTasks(status === '退出审批中' && can('buyer:workflow:review'));
  const task = tasks.data?.data?.find(t => t.businessType === 'buyer_supplier_exit' && t.businessId === id);
  const refresh = () => client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string'
    && /\/buyer\/(suppliers|workflow)/.test(q.queryKey[0]) });
  // Java Map<String,Object> permits scalar form values; the generated index type is narrower.
  const submit = useMutation({ mutationFn: (formData: Record<string, unknown>) => supplierExitSubmitExit(id, { reason, formData: formData as SubmitSupplierExitRequest['formData'] }),
    onSuccess: () => { setOpen(false); setReason(''); void refresh(); } });
  const prepare = async () => {
    if (pending.current || !can('buyer:supplier:manage') || status !== '已准入') return;
    pending.current = true;
    setLoading(true); setMessage(''); setOpen(false); setChecked(null);
    try {
      const { data } = await getSupplierExitRisk(id);
      if (context.current.id !== id || context.current.status !== '已准入' || !context.current.manage) return;
      if (!isSupplierExitRisk(data)) { setMessage('核查数据不完整或格式异常，暂不能申请退出，请重新核查。'); return; }
      setChecked({ relationId: id, risk: data });
      if (isSupplierExitBlocked(data)) {
        setMessage('暂不能退出，请先处理以下未结业务并重新核查。');
      } else { submit.reset(); setOpen(true); }
    } catch { setMessage('未结业务核查失败，请刷新后重试。'); }
    finally { pending.current = false; setLoading(false); }
  };
  if (status !== '已准入' && status !== '退出审批中') return null;
  return <section className="space-y-3 pb-3">
    {message && <FeedbackNotice tone="info" message={message} />}
    {status === '已准入' && can('buyer:supplier:manage') && <button type="button" disabled={loading}
      onClick={() => void prepare()} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50">
      <LogOut size={16} />{loading ? '核查未结业务…' : risk ? '重新核查退出条件' : '申请退出'}
    </button>}
    {risk && status === '已准入' && can('buyer:supplier:manage') && <>
      <section aria-label="退出清算核查" className="min-w-0 space-y-3 border-t border-slate-200 pt-3">
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li>未收货订单 {risk.unreceivedOrderCount} 笔</li><li>未付清发票 {risk.unpaidInvoiceCount} 张</li>
          <li>未归档合同 {risk.unarchivedContractCount} 份</li><li>未结售后 {risk.openAfterSalesCount} 笔</li>
          <li>未足额开票订单 {risk.uninvoicedOrderCount} 笔</li><li>付款待核验 {risk.paymentVerificationRequiredCount} 笔</li>
        </ul>
        <p className="break-words text-sm font-bold">已核验发票剩余金额：{risk.remainingInvoiceAmount === null ? '待核对' : `¥${risk.remainingInvoiceAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
        <p className="text-xs text-slate-500">不含未开票及待核验金额，不代表全部应付款。</p>
        {risk.uninvoicedOrderCount > 0 && <p className="text-sm text-amber-800">未足额开票订单（含未开票及部分开票）：请按明细中的异常原因和处理岗位核对开票覆盖情况，处理后重新核查退出条件。</p>}
        {risk.paymentVerificationRequiredCount > 0 && <p className="text-sm text-amber-800">付款待核验：请按明细中的异常原因由财务岗位核对付款记录，处理后重新核查退出条件。</p>}
        {risk.openAfterSalesCount > 0 && <p className="text-sm text-amber-800">未结售后：请在采购商城的售后处理页签核对处理进度。</p>}
        {risk.blocked && ![risk.unreceivedOrderCount, risk.unpaidInvoiceCount, risk.unarchivedContractCount, risk.openAfterSalesCount, risk.uninvoicedOrderCount, risk.paymentVerificationRequiredCount].some(Boolean)
          && <p role="alert" className="text-sm text-amber-800">服务端仍标记为不可退出，请联系业务负责人核查。</p>}
      </section>
      {supplierId && isSupplierExitBlocked(risk) && <SupplierUnsettledBusiness key={`${id}:${supplierId}`} relationId={id} supplierId={supplierId}
        orderCount={risk.unreceivedOrderCount} invoiceCount={risk.unpaidInvoiceCount}
        contractCount={risk.unarchivedContractCount} afterSalesCount={risk.openAfterSalesCount}
        uninvoicedCount={risk.uninvoicedOrderCount} verificationCount={risk.paymentVerificationRequiredCount} />}
    </>}
    {status === '退出审批中' && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      <span>{tasks.isError ? '审批任务加载失败，请刷新重试。' : task ? '当前退出审批由您办理。' : '退出审批中，暂停新增订单。请展开审批信息查看办理进度。'}</span>
      {task && !tasks.isError && can('buyer:workflow:review') && <>
        <button type="button" className="h-10 whitespace-nowrap rounded-lg bg-blue-600 px-4 font-bold text-white" onClick={() => setReview({ task, approved: true })}>通过退出</button>
        <button type="button" className="h-10 whitespace-nowrap rounded-lg border border-red-200 px-4 font-bold text-red-600" onClick={() => setReview({ task, approved: false })}>驳回退出</button>
      </>}
    </div>}
    {open && canSubmit && createPortal(<WorkflowSubmitDialog businessType="buyer_supplier_exit" title="供应商退出" busy={submit.isPending}
      submissionError={submit.error} onClose={() => setOpen(false)} onSubmit={data => {
        if (!canSubmit) return;
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
