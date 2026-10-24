import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useWorkflowBusinessInstances, useUnifiedWorkflowInstanceHistory } from '@24bid/api-client';
import { FeedbackNotice, StatusPill } from '@24bid/ui';
import { WorkflowInstancePanel } from '../workflow/workflow-instance-panel';

const labels: Record<string, string> = { processing: '审批中', approved: '已通过', rejected: '已驳回', cancelled: '已取消' };
const button = 'inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40';
const date = (value?: string) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

export function SupplierApprovalHistory({ businessId }: { businessId: string }) {
  return <HistoryWorkspace key={businessId} businessId={businessId} />;
}

function HistoryWorkspace({ businessId }: { businessId: string }) {
  const [type, setType] = useState('buyer_supplier_admission');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const query = useWorkflowBusinessInstances(type, businessId, page);
  const data = query.data?.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));
  useEffect(() => { if (data && !query.isError && page > pages) setPage(pages); }, [data, query.isError, page, pages]);
  return <section aria-label="供应商审批历史" className={`mb-5 min-w-0 ${selected ? '' : 'rounded-lg border border-slate-200 bg-white p-4 sm:p-5'}`}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="审批类型" className="inline-flex gap-1 rounded-md bg-slate-100 p-1">
        {[['buyer_supplier_admission', '准入审批'], ['buyer_supplier_exit', '退出审批']].map(([key, label]) => <button key={key} role="tab" aria-selected={type === key} type="button"
          onClick={() => { setType(key); setPage(1); setSelected(undefined); }}
          className={`h-8 whitespace-nowrap rounded px-3 text-xs font-bold ${type === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>{label}</button>)}
      </div>
      {!selected && <button type="button" title="刷新审批历史" aria-label="刷新审批历史" disabled={query.isFetching} onClick={() => void query.refetch()} className={button}><RefreshCw size={14} /></button>}
    </div>
    {selected ? <AttemptDetail id={selected} onBack={() => setSelected(undefined)} /> : query.isError ? <div role="alert"><FeedbackNotice tone="error" message="审批历史加载失败，请重试。" /><button type="button" className={`${button} mt-3`} onClick={() => void query.refetch()}>重试</button></div>
      : query.isLoading ? <FeedbackNotice tone="info" message="正在读取审批历史…" /> : <>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr>{['序号', '审批实例', '状态', '发起人', '发起时间', '完成时间', '操作'].map(label => <th key={label} className="whitespace-nowrap px-3 py-3 font-bold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{data?.items.map((item, index) => <tr key={item.workflowInstanceId}>
              <td className="px-3 py-3 tabular-nums text-slate-500">{(page - 1) * 10 + index + 1}</td>
              <td className="max-w-48 px-3 py-3"><span title={item.workflowInstanceId} className="block max-w-48 truncate font-mono text-slate-700">{item.workflowInstanceId}</span></td>
              <td className="whitespace-nowrap px-3 py-3"><StatusPill label={labels[item.status] ?? item.status} /></td>
              <td className="max-w-32 truncate px-3 py-3" title={item.initiatorName ?? item.initiatorId}>{item.initiatorName ?? item.initiatorId}</td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-500">{date(item.createdAt)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-500">{date(item.completedAt)}</td>
              <td className="px-3 py-3"><button type="button" className={button} onClick={() => setSelected(item.workflowInstanceId)}>详情</button></td>
            </tr>)}</tbody>
          </table>
          {!data?.items.length && <p className="p-6 text-center text-sm text-slate-400">暂无审批记录。</p>}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span>共 {data?.total ?? 0} 条</span><div className="flex items-center gap-2">
            <button type="button" aria-label="上一页" className={button} disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
            <span className="min-w-12 text-center tabular-nums">{page} / {pages}</span>
            <button type="button" aria-label="下一页" className={button} disabled={page >= pages || query.isFetching} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      </>}
  </section>;
}

function AttemptDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useUnifiedWorkflowInstanceHistory(id);
  return <div className="min-w-0">
    <button type="button" className={`${button} mb-4`} onClick={onBack}><ArrowLeft size={14} /> 返回审批列表</button>
    {query.isError ? <div role="alert"><FeedbackNotice tone="error" message="审批详情加载失败，请重试。" /><button type="button" className={`${button} mt-3`} onClick={() => void query.refetch()}>重试</button></div>
      : query.isLoading ? <FeedbackNotice tone="info" message="正在读取审批详情…" />
        : query.data?.data ? <WorkflowInstancePanel key={id} history={query.data.data} /> : <FeedbackNotice tone="info" message="未找到审批详情。" />}
  </div>;
}
