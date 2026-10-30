import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FeedbackNotice, SectionCard, StatusPill } from '@24bid/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import { workflowTaskClient, workflowOperationError } from './workflow-task-client';

export function AdditionalReviewDecision({ taskId, onDone, onBusyChange }: {
  taskId: string; onDone: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [comment, setComment] = useState('');
  const client = useQueryClient();
  const current = useQuery({queryKey: ['workflow-additional-current', taskId], queryFn: () => workflowTaskClient.additional(taskId)});
  const decision = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!current.data) throw new Error('加审任务不存在');
      onBusyChange(true);
      try { await workflowTaskClient.decideAdditional(taskId, current.data.id, action, comment.trim()); }
      finally { onBusyChange(false); }
    },
    onSuccess: () => {
      void client.invalidateQueries({queryKey: ['ludong-poc']});
      void client.invalidateQueries({queryKey: ['workflow-task-timing', taskId]});
      void client.invalidateQueries({queryKey: ['workflow-additional-history']});
      void client.invalidateQueries({queryKey: ['workflow-additional-current', taskId]});
      onDone();
    },
  });
  return <SectionCard title="加审意见" extra={<StatusPill label="前置加审" />}>
    {current.data && <div className="mb-4 space-y-1 text-sm text-slate-600">
      <p>发起加审：{current.data.requesterName} · 加审人：{current.data.reviewerName}</p>
      <p className="whitespace-pre-wrap break-words">加审说明：{current.data.reason}</p>
    </div>}
    {current.isError && <FeedbackNotice tone="error" message="加审信息加载失败，请刷新后重试。" />}
    <label className="block text-sm font-bold text-slate-700">加审意见 <span className="text-red-600">*</span>
      <textarea aria-label="加审意见" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)}
        disabled={decision.isPending} className="mt-2 h-28 w-full rounded-md border border-slate-200 p-3 font-normal" />
    </label>
    {decision.isError && <FeedbackNotice tone="error" message={workflowOperationError(decision.error, '加审提交失败，请刷新后重试。')} />}
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <ActionButton icon={XCircle} tone="red" disabled={!current.data || current.isFetching || !comment.trim() || decision.isPending}
        onClick={() => decision.mutate('reject')}>加审不同意</ActionButton>
      <ActionButton icon={CheckCircle2} tone="blue" disabled={!current.data || current.isFetching || !comment.trim() || decision.isPending}
        onClick={() => decision.mutate('approve')}>加审同意</ActionButton>
    </div>
  </SectionCard>;
}

export function AdditionalReviewHistory({ instanceId }: { instanceId: string }) {
  const history = useQuery({queryKey: ['workflow-additional-history', instanceId], queryFn: () => workflowTaskClient.additionalHistory(instanceId)});
  if (history.isError) return <FeedbackNotice tone="error" message="加审记录加载失败，请刷新后重试。" />;
  if (!history.data?.length) return null;
  return <SectionCard title="加审记录">
    <div className="divide-y divide-slate-100">
      {history.data.map((review) => {
        let comment = '';
        try { comment = JSON.parse(review.reviewData).comment || ''; } catch { comment = '历史意见格式异常，需管理员核对。'; }
        return <article key={review.id} className="py-3 text-sm first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{review.reviewerName}</strong><StatusPill label={{pending:'加审中',approved:'加审同意',rejected:'加审不同意',cancelled:'已撤回'}[review.status]} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{review.requesterName} 发起 · {new Date(review.createdAt).toLocaleString('zh-CN')}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-slate-600">{review.reason}</p>
          {comment && <p className="mt-2 whitespace-pre-wrap break-words">意见：{comment}</p>}
        </article>;
      })}
    </div>
  </SectionCard>;
}
