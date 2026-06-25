import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Workflow } from 'lucide-react';
import {
  useFlowableDemandApprovalComplete,
  useFlowableDemandApprovalStart,
  useFlowableDemandApprovalTasks,
  usePurchaseDemandList,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

// Flowable 工作流引擎驱动的采购需求审批(区别于固定审批模板)。
export function FlowableWorkflowPanel() {
  const queryClient = useQueryClient();
  const demands = usePurchaseDemandList();
  const tasks = useFlowableDemandApprovalTasks();
  const start = useFlowableDemandApprovalStart();
  const complete = useFlowableDemandApprovalComplete();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [demandId, setDemandId] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});

  const demandList = demands.data?.data ?? [];
  const taskList = tasks.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/workflow/'),
    });

  const onStart = () =>
    start.mutate(
      { demandId },
      {
        onSuccess: () => {
          setFeedback(`已为需求 ${demandId} 启动 Flowable 审批流程`);
          setDemandId('');
          refresh();
        },
      },
    );

  const onComplete = (taskId: string, approved: boolean) =>
    complete.mutate(
      { taskId, data: { approved, comment: comments[taskId] || undefined } },
      { onSuccess: () => { setFeedback(`工作流任务已${approved ? '通过' : '驳回'}`); refresh(); } },
    );

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <Panel title="工作流审批(Flowable)" icon={Workflow} subtitle="引擎驱动 · BPMN 流程 · 区别于固定模板">
      {feedback && (
        <div className="mb-3">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
        <p className="text-xs font-black text-blue-800">为采购需求启动审批流程</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select className={`${inputCls} max-w-xs`} value={demandId} onChange={(e) => setDemandId(e.target.value)}>
            <option value="">选择采购需求</option>
            {demandList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}（{d.id}）
              </option>
            ))}
          </select>
          <PrimaryActionButton onClick={onStart} busy={start.isPending} pendingLabel="启动中" disabled={!demandId}>
            启动工作流
          </PrimaryActionButton>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-black text-slate-500">待办工作流任务</p>
        {tasks.isLoading ? (
          <p className="mt-2 text-xs font-bold text-slate-400">加载中…</p>
        ) : taskList.length === 0 ? (
          <p className="mt-2 text-xs font-bold text-slate-400">暂无工作流任务。启动流程后在此审批。</p>
        ) : (
          <div className="mt-2 space-y-3">
            {taskList.map((t) => {
              const busy = complete.isPending && complete.variables?.taskId === t.taskId;
              return (
                <div key={t.taskId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{t.name}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-500">需求 {t.demandId}</p>
                    </div>
                    <StatusPill label="审批中" />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <MiniFact label="流程实例" value={t.processInstanceId?.slice(0, 12) ?? '—'} />
                    <MiniFact label="创建时间" value={t.createdAt?.slice(0, 24) ?? '—'} />
                  </div>
                  <input className={`${inputCls} mt-2`} placeholder="审批意见(选填)"
                    value={comments[t.taskId ?? ''] ?? ''}
                    onChange={(e) => setComments((c) => ({ ...c, [t.taskId ?? '']: e.target.value }))} />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => t.taskId && onComplete(t.taskId, true)} disabled={busy}
                      className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-400">
                      {busy ? '处理中' : '通过'}
                    </button>
                    <button type="button" onClick={() => t.taskId && onComplete(t.taskId, false)} disabled={busy}
                      className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50">
                      驳回
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
