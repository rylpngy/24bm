import type { ComponentProps } from 'react';
import { useWorkflowBusinessHistory } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

export function SupplierAdmissionSubmitDialog({ relationId, ...props }: Omit<ComponentProps<typeof WorkflowSubmitDialog>, 'businessType' | 'initialValues'> & { relationId: string }) {
  const { can } = useBuyerPermissions();
  const canReadHistory = can('buyer:workflow:read') || can('buyer:workflow:review') || can('buyer:workflow:manage');
  const query = useWorkflowBusinessHistory(canReadHistory ? 'buyer_supplier_admission' : undefined, relationId);
  if (query.isLoading || query.isError) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="读取准入记录" className="w-full max-w-xl rounded-lg bg-white p-5">
        <FeedbackNotice tone={query.isError ? 'error' : 'info'} message={query.isError ? '历史申请读取失败，请重试后提交。' : '正在读取历史申请…'} />
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={props.onClose}>取消</button>
          {query.isError && <button type="button" onClick={() => void query.refetch()} className="text-blue-600">重试</button>}
        </div>
      </div>
    </div>
  );
  const previous = query.data?.data;
  const rejected = previous?.status === 'rejected';
  const reason = rejected ? previous.events.filter(event => event.action === 'rejected').at(-1)?.comment : undefined;
  return <WorkflowSubmitDialog {...props} businessType="buyer_supplier_admission" initialValues={rejected ? previous.formData : undefined}>
    {rejected && <FeedbackNotice tone="info" message={`上次驳回意见：${reason || '未填写意见'}。请先在供应商详情补充资料，再确认本次申请字段。`} />}
  </WorkflowSubmitDialog>;
}
