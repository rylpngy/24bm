import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenderDocumentReviews, submitTenderDocumentReview } from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';

export function TenderDocumentReviewPanel({ tenderId, drafting, canManage }: { tenderId: string; drafting: boolean; canManage: boolean }) {
  const client = useQueryClient();
  const queryKey = ['tender-document-review', tenderId];
  const query = useQuery({ queryKey, queryFn: () => tenderDocumentReviews(tenderId) });
  const [open, setOpen] = useState(false);
  const mutation = useMutation({ mutationFn: (form: Record<string, unknown>) => submitTenderDocumentReview(tenderId, form),
    onSuccess: () => { setOpen(false); void client.invalidateQueries({ queryKey }); } });
  const data = query.data?.data;
  const current = data?.reviews[0];
  return <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-black text-slate-950">采购文件审查</h2>
      {drafting && canManage && <PrimaryActionButton flushTop busy={mutation.isPending} disabled={!data || current?.status === 'processing' || data.currentApproved}
        disabledReason={current?.status === 'processing' ? '请等待独立审查人办理' : '当前文件已审查通过'} onClick={() => setOpen(true)}>提交审查</PrimaryActionButton>}
    </div>
    {query.isLoading ? <FeedbackNotice tone="info" message="正在加载采购文件审查…" />
      : query.isError ? <FeedbackNotice tone="error" message="采购文件审查加载失败，请刷新重试。" />
      : <p className="mt-2 text-sm text-slate-600">{current?.status === 'processing' ? '审查中，文件及附件已锁定。'
        : drafting && data?.currentApproved ? '当前文件已审查通过，可以发布。'
        : drafting && current?.status === 'approved' ? '文件已变更，发布前须重新审查。'
        : current?.status === 'rejected' ? '审查已驳回，请按意见修改后重新提交。'
        : current?.status === 'approved' ? '发布前采购文件审查已通过。' : '编制完成后提交独立审查，通过后方可发布。'}</p>}
    {data?.reviews.map(review => <div key={review.id} className="mt-3 border-t border-slate-100 pt-3">
      <WorkflowStatusPanel businessType="tender_document_review" businessId={review.id} compact />
      <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-blue-700">查看送审资料与完整历史</summary>
        <WorkflowStatusPanel businessType="tender_document_review" businessId={review.id} />
      </details>
    </div>)}
    {open && <WorkflowSubmitDialog businessType="tender_document_review" title="采购文件审查" busy={mutation.isPending}
      submissionError={mutation.error} onClose={() => { if (!mutation.isPending) setOpen(false); }} onSubmit={form => mutation.mutate(form)} />}
  </section>;
}
