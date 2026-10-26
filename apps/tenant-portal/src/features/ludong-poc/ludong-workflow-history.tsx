import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, FeedbackNotice, Pagination, Panel, SectionCard, StatusPill } from '@24bid/ui';
import { History, X } from 'lucide-react';
import { ludongApi, type LudongApplication, type WorkflowHistory } from './api';
import { buildApprovalSnapshotSections, LudongPocApplicationSnapshot } from './ludong-poc-application-snapshot';
import { AdditionalReviewHistory } from '../process/additional-review-panel';

const labels: Record<string,string> = {processing:'审批中',approved:'已通过',rejected:'已驳回',cancelled:'已撤回'};
export function LudongWorkflowHistory({ application, renderProgress }: {
  application: LudongApplication; renderProgress: (history?: WorkflowHistory) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState('');
  const ledger = useQuery({queryKey: ['ludong-poc','instances',application.id,page], queryFn: () => ludongApi.instances(application.id,page)});
  const history = useQuery({queryKey: ['ludong-poc','instance-history',selected], queryFn: () => ludongApi.historyById(selected), enabled: !!selected});
  const records = useQuery({queryKey: ['ludong-poc','review-records',application.id,selected], queryFn: () => ludongApi.reviewRecords(application.id,selected), enabled: !!selected});
  const snapshot = history.data?.businessSnapshot;
  const hasSnapshot = snapshot?.formData && Array.isArray(snapshot.items) && typeof snapshot.projectName === 'string';
  const historicalApp = hasSnapshot ? {
    ...application, projectName: String(snapshot.projectName), applicantUnit: String(snapshot.applicantUnit),
    budgetAmount: Number(snapshot.budgetAmount), formData: snapshot.formData as LudongApplication['formData'],
    items: snapshot.items as LudongApplication['items'],
  } : null;
  return <div className="space-y-5">
    <Panel title="历次审批" icon={History}>
      {ledger.isError && <FeedbackNotice tone="error" message="历史流程加载失败，请刷新后重试。" />}
      {ledger.isPending && <p className="text-sm text-slate-500">正在加载...</p>}
      <div className="divide-y divide-slate-100">
        {(ledger.data?.items ?? []).map((item) => <div key={item.workflowInstanceId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm"><p className="font-bold text-slate-800">{item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '历史流程'} · {item.initiatorName}</p>
            <p className="mt-1 break-all text-xs text-slate-500">{item.definitionVersionId}</p></div>
          <div className="flex shrink-0 items-center gap-3"><StatusPill label={labels[item.status] || item.status} />
            <ActionButton onClick={() => setSelected(item.workflowInstanceId)}>详情</ActionButton></div>
        </div>)}
      </div>
      {!ledger.isPending && !ledger.isError && !ledger.data?.total && <p className="text-sm text-slate-500">尚未发起审批。</p>}
      {!!ledger.data?.total && <Pagination page={page} pageSize={5} total={ledger.data.total} onPageChange={setPage} />}
    </Panel>
    {selected && <>
      <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">流程记录详情</h3><ActionButton icon={X} onClick={() => setSelected('')}>收起</ActionButton></div>
      {(history.isError || records.isError) && <FeedbackNotice tone="error" message="历史审批材料加载失败，请重试。" />}
      {history.isPending && <p role="status" className="text-sm text-slate-500">正在加载审批记录...</p>}
      {history.data && <>
        {renderProgress(history.data)}
        <SectionCard title="本轮发起材料快照">
          {historicalApp ? <LudongPocApplicationSnapshot app={historicalApp} includeApprovals={false} />
            : <FeedbackNotice tone="info" message="旧流程未保存完整申报快照，仅展示实际留存的流程记录，不以当前材料冒充历史版本。" />}
        </SectionCard>
        {!!records.data?.length && <SectionCard title="本轮节点表单与意见">
          <div className="divide-y divide-slate-100">
            {records.data.map((record) => {
              const event = history.data?.events.find((item) => item.flowableTaskId === record.workflowTaskId && ['approved','rejected'].includes(item.action));
              let values: LudongApplication['formData'] = {};
              try { values = JSON.parse(record.reviewDataJson); } catch { return <FeedbackNotice key={record.id} tone="error" message="历史节点表单格式异常，需管理员核对。" />; }
              const sections = buildApprovalSnapshotSections({...application,formData:values});
              return <article key={record.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{event?.nodeName || record.nodeId} · {event?.actorName || record.reviewerId}</strong>
                  <StatusPill label={event?.effective === false ? '已失效' : record.decision === 'approve' ? '通过' : '驳回'} /></div>
                <p className="mt-1 text-xs text-slate-500">{new Date(record.reviewedAt).toLocaleString('zh-CN')}</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">{sections.flatMap((section) => section.facts).filter(([,value]) => !!value).map(([label,value]) =>
                  <div key={label} className="text-sm"><dt className="text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-900">{value}</dd></div>)}</dl>
                {record.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">办理意见：{record.comment}</p>}
              </article>;
            })}
          </div>
        </SectionCard>}
        <AdditionalReviewHistory instanceId={history.data.workflowInstanceId} />
      </>}
    </>}
  </div>;
}
