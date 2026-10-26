import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { ActionButton, FeedbackNotice, SectionCard } from '@24bid/ui';
import { ArrowRightLeft, CalendarClock, Copy, Send, UserPlus, Undo2 } from 'lucide-react';
import { workflowTaskClient } from './workflow-task-client';

type Action = 'transfer' | 'copy' | 'deadline' | 'remind' | 'additional' | 'return';
type Recipient = { id: string; name: string; employeeNo?: string };
const actions = [
  { id: 'transfer' as const, label: '转审', icon: ArrowRightLeft },
  { id: 'copy' as const, label: '抄送', icon: Copy },
  { id: 'deadline' as const, label: '办理时限', icon: CalendarClock },
  { id: 'remind' as const, label: '补件催办', icon: Send },
  { id: 'additional' as const, label: '加审', icon: UserPlus },
  { id: 'return' as const, label: '退回', icon: Undo2 },
];
const inputClass = 'h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900';

export function WorkflowTaskOperations({ taskId, disabled, onTransferred, onBusyChange }: {
  taskId: string; disabled?: boolean; onTransferred: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const [action, setAction] = useState<Action>('transfer');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('');
  const recipients = useQuery({
    queryKey: ['workflow-task-recipients', taskId],
    queryFn: async () => (await axiosInstance.get<{ data: Recipient[] }>(`/api/v1/buyer/workflow/tasks/${taskId}/recipients`)).data.data,
  });
  const timing = useQuery({
    queryKey: ['workflow-task-timing', taskId],
    queryFn: () => workflowTaskClient.timing(taskId),
  });
  const targets = useQuery({
    queryKey: ['workflow-return-targets', taskId],
    queryFn: () => workflowTaskClient.targets(taskId),
    enabled: action === 'return' && !!timing.data?.reworkSupported,
  });
  const operation = useMutation({
    mutationFn: async () => {
      onBusyChange(true);
      try {
        if (action === 'additional') return await workflowTaskClient.requestAdditional(taskId, recipient, reason.trim());
        if (action === 'return') return await workflowTaskClient.returnTask(taskId, target, reason.trim());
        await axiosInstance.post(`/api/v1/buyer/workflow/tasks/${taskId}/operations`, {
          action, reason: reason.trim(), recipientIds: recipient ? [recipient] : [],
          dueAt: action === 'deadline' ? new Date(dueAt).toISOString() : null,
        });
      } finally { onBusyChange(false); }
    },
    onSuccess: () => {
      setMessage(action === 'transfer' ? '已转交新的办理人。' : '操作已保存，记录已写入审批历史。');
      void client.invalidateQueries({ queryKey: ['ludong-poc'] });
      void client.invalidateQueries({ queryKey: ['workflow-task-timing', taskId] });
      void client.invalidateQueries({ queryKey: ['workflow-additional-history'] });
      void client.invalidateQueries({ queryKey: ['workflow-additional-current', taskId] });
      if (action === 'transfer' || action === 'additional' || action === 'return') onTransferred();
    },
  });
  const error = (operation.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;
  return <SectionCard title="任务协同" className="shadow-none">
    <div className="flex flex-wrap gap-2">
      {actions.filter((item) => (!['additional','return'].includes(item.id) || timing.data?.reworkSupported)
        && (!timing.data?.additionalReview || !['additional','return','transfer'].includes(item.id))).map((item) => <ActionButton key={item.id} icon={item.icon} disabled={disabled || operation.isPending}
        onClick={() => { setAction(item.id); setMessage(''); operation.reset(); }}
        tone={action === item.id ? 'blue' : 'neutral'}
        title={action === item.id ? '当前操作' : `选择${item.label}`}>{item.label}</ActionButton>)}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {['transfer','copy','additional'].includes(action) && <label className="space-y-1 text-sm font-bold text-slate-600">
        <span>{action === 'transfer' ? '转审办理人' : action === 'additional' ? '加审人' : '抄送人'} <span className="text-red-600">*</span></span>
        <select aria-label="任务接收人" className={inputClass} value={recipient} disabled={disabled || operation.isPending}
          onChange={(event) => setRecipient(event.target.value)}>
          <option value="">请选择</option>
          {(recipients.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}{user.employeeNo ? ` · ${user.employeeNo}` : ''}</option>)}
        </select>
      </label>}
      {action === 'return' && <label className="space-y-1 text-sm font-bold text-slate-600">
        <span>退回节点 <span className="text-red-600">*</span></span>
        <select aria-label="退回节点" className={inputClass} value={target} disabled={disabled || operation.isPending || targets.isPending}
          onChange={(event) => setTarget(event.target.value)}>
          <option value="">请选择已办理的前序节点</option>
          {(targets.data ?? []).map((item) => <option key={item.nodeId} value={item.nodeId}>{item.name}</option>)}
        </select>
        {!targets.isPending && !targets.isError && !targets.data?.length && <span className="block text-xs font-normal">当前没有可退回的前序节点；需退回申请人补充材料时可驳回申报。</span>}
      </label>}
      {action === 'deadline' && <label className="space-y-1 text-sm font-bold text-slate-600">
        <span>办理截止时间 <span className="text-red-600">*</span></span>
        <input aria-label="办理截止时间" type="datetime-local" className={inputClass} value={dueAt}
          disabled={disabled || operation.isPending} onChange={(event) => setDueAt(event.target.value)} />
      </label>}
      <label className="space-y-1 text-sm font-bold text-slate-600"><span>操作说明 <span className="text-red-600">*</span></span>
        <input aria-label="任务操作说明" maxLength={1000} className={inputClass} value={reason}
          disabled={disabled || operation.isPending} onChange={(event) => setReason(event.target.value)} />
      </label>
    </div>
    {timing.data?.dueAt && <p className={`mt-3 text-sm ${new Date(timing.data.dueAt).getTime()<Date.now()?'font-bold text-red-600':'text-slate-500'}`}>
      当前办理时限：{new Date(timing.data.dueAt).toLocaleString('zh-CN')}
      {new Date(timing.data.dueAt).getTime()<Date.now()?'（已超期）':''}</p>}
    {(recipients.isError || timing.isError) && <FeedbackNotice tone="error" message="任务信息加载失败，请关闭后重新打开。" />}
    {targets.isError && <FeedbackNotice tone="error" message="可退回节点加载失败，请刷新后重试。" />}
    {timing.data?.additionalRejected && <FeedbackNotice tone="error" message="加审意见为不同意，只能退回或驳回。" />}
    {operation.isError && <FeedbackNotice tone="error" message={error || '操作失败，请刷新任务后重试。'} />}
    {message && <FeedbackNotice tone="info" message={message} />}
    <div className="mt-3 flex justify-end"><ActionButton icon={Send} disabled={disabled || operation.isPending
      || timing.isPending || timing.isError || !reason.trim() || (['transfer','copy','additional'].includes(action) && !recipient)
      || (action === 'return' && (!target || targets.isError || targets.isPending)) || (action === 'deadline' && !dueAt)
      || (timing.data?.additionalReview && ['transfer','additional','return'].includes(action))}
      onClick={() => operation.mutate()}>{operation.isPending ? '保存中' : `确认${actions.find((item) => item.id === action)?.label}`}</ActionButton></div>
  </SectionCard>;
}
