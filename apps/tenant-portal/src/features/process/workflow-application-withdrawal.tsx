import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FeedbackNotice, PrimaryActionButton } from '@24bid/ui';
import { Undo2, X } from 'lucide-react';
import { workflowTaskClient, workflowOperationError } from './workflow-task-client';

export function WorkflowApplicationWithdrawal({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const withdrawal = useMutation({
    mutationFn: () => workflowTaskClient.withdraw(instanceId, reason.trim()),
    onSuccess: () => {
      void client.invalidateQueries({queryKey: ['ludong-poc']});
      void client.invalidateQueries({queryKey: ['workflow-additional-history']});
      setOpen(false); setReason('');
    },
  });
  return <>
    <ActionButton icon={Undo2} tone="red" onClick={() => { withdrawal.reset(); setOpen(true); }}>撤回申报</ActionButton>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="withdrawal-title" className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3"><h2 id="withdrawal-title" className="text-lg font-bold text-slate-950">撤回采购申报</h2>
          <button type="button" aria-label="关闭撤回窗口" disabled={withdrawal.isPending} onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center"><X size={18} /></button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">撤回后停止本轮所有审批任务，申报恢复草稿。原审批记录保留；修改后重新提交将发起新一轮审批。</p>
        <label className="mt-4 block text-sm font-bold text-slate-700">撤回原因 <span className="text-red-600">*</span>
          <textarea aria-label="撤回原因" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)}
            disabled={withdrawal.isPending} className="mt-2 h-28 w-full rounded-md border border-slate-200 p-3 font-normal" />
        </label>
        {withdrawal.isError && <FeedbackNotice tone="error" message={workflowOperationError(withdrawal.error, '撤回失败，请刷新审批状态后重试。')} />}
        <div className="mt-4 flex justify-end gap-2"><ActionButton disabled={withdrawal.isPending} onClick={() => setOpen(false)}>取消</ActionButton>
          <PrimaryActionButton icon={Undo2} tone="red" flushTop busy={withdrawal.isPending} disabled={!reason.trim()} onClick={() => withdrawal.mutate()}>确认撤回</PrimaryActionButton>
        </div>
      </section>
    </div>}
  </>;
}
