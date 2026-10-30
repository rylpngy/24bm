import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { ActionButton, FeedbackNotice } from '@24bid/ui';
import { BellRing } from 'lucide-react';

export function WorkflowInstanceReminder({ instanceId }: { instanceId: string }) {
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const remind = useMutation({
    mutationFn: () => axiosInstance.post(`/api/v1/buyer/workflow/instances/${instanceId}/remind`, { reason }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['ludong-poc', 'history'] }); },
  });
  const error = (remind.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;
  return <details className="border-t border-slate-100 pt-3">
    <summary className="cursor-pointer text-sm font-bold text-slate-700">催办当前审批人</summary>
    <div className="mt-3 flex flex-wrap gap-2">
      <input aria-label="催办说明" maxLength={1000} placeholder="填写催办说明" value={reason}
        onChange={(event) => setReason(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm" />
      <ActionButton icon={BellRing} disabled={!reason.trim() || remind.isPending} onClick={() => remind.mutate()}>
        {remind.isPending ? '发送中' : '发送催办'}
      </ActionButton>
    </div>
    {remind.isSuccess && <FeedbackNotice tone="info" message="已向当前办理人发送站内催办通知。" />}
    {remind.isError && <FeedbackNotice tone="error" message={error || '催办发送失败，请刷新后重试。'} />}
  </details>;
}
