import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Search, XCircle } from 'lucide-react';
import {
  type WorkflowInstanceLedgerItem,
  type WorkflowLedgerView,
  useUnifiedWorkflowCompleteTask,
  useUnifiedWorkflowInstanceHistory,
  useWorkflowInstancesLedgerPage,
} from '@24bid/api-client';
import { FeedbackNotice, Tabs, cn } from '@24bid/ui';
import { WorkflowInstancePanel } from '../workflow/workflow-instance-panel';

const VIEWS: Array<{ id: WorkflowLedgerView; label: string }> = [
  { id: 'pending', label: '待办' },
  { id: 'processed', label: '已办' },
  { id: 'initiated', label: '我发起的' },
  { id: 'all', label: '全部实例' },
];

const statusLabel: Record<string, string> = {
  processing: '审批中', approved: '已通过', rejected: '已驳回', cancelled: '已取消',
};

const businessLabel: Record<string, string> = {
  budget_change: '预算编制与调整', budget_exception: '超预算例外',
  project_initiation: '项目立项',
  supplier_qualification_change: '供应商资质变更',
  purchase_demand: '采购需求', buyer_supplier_admission: '供应商准入', buyer_supplier_exit: '供应商退出', rfq_award: '询价定标',
  contract_approval: '合同审批', payment_request: '付款申请', payment_batch: '付款批次',
  payment_archive_exception: '付款归档例外',
};

export function WorkflowLedgerPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<WorkflowLedgerView>('pending');
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<WorkflowInstanceLedgerItem | null>(null);
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const query = useWorkflowInstancesLedgerPage(view, page, pageSize, search);
  const complete = useUnifiedWorkflowCompleteTask();
  const history = useUnifiedWorkflowInstanceHistory(selected?.workflowInstanceId);
  const filtered = query.data?.data?.items ?? [];
  const total = query.data?.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (query.data?.data && !query.isError && !query.isFetching && page > pages) setPage(pages);
  }, [query.data, query.isError, query.isFetching, page, pages]);
  const canComplete = view === 'pending' && !history.isLoading && !history.isFetching && !history.isError
    && history.data?.data?.status === 'processing'
    && Boolean(selected?.currentTask?.taskId)
    && history.data?.data?.currentTask?.taskId === selected?.currentTask?.taskId;

  const completeTask = (action: 'approve' | 'reject') => {
    const taskId = selected?.currentTask?.taskId;
    if (!taskId || !canComplete) return;
    complete.mutate(
      { taskId, data: { action, comment } },
      {
        onSuccess: () => {
          setFeedback(action === 'approve' ? '审批已通过。' : '审批已驳回。');
          setSelected(null);
          setComment('');
          void queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/workflow/') });
        },
      },
    );
  };

  if (selected) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={() => setSelected(null)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50"><ArrowLeft size={14} /> 返回台账</button>
          <div><h1 className="text-lg font-black text-slate-950">{businessLabel[selected.businessType] ?? selected.businessType}</h1><p className="mt-1 font-mono text-xs font-bold text-slate-400">{selected.businessId}</p></div>
        </div>
        {history.isLoading ? <FeedbackNotice tone="info" message="正在读取审批详情…" /> : !history.isError && history.data?.data ? <WorkflowInstancePanel history={history.data.data} /> : <FeedbackNotice tone="error" message="审批详情加载失败。" />}
        {canComplete && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <label className="text-xs font-black text-slate-600">审批意见</label>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-blue-300" placeholder="填写审批意见（选填）" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" disabled={complete.isPending} onClick={() => completeTask('reject')} className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 px-4 text-xs font-black text-red-700 hover:bg-red-50"><XCircle size={14} /> 驳回</button>
              <button type="button" disabled={complete.isPending} onClick={() => completeTask('approve')} className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700"><CheckCircle2 size={14} /> 通过</button>
            </div>
          </section>
        )}
        {complete.isError && <FeedbackNotice tone="error" message={(complete.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '审批办理失败。'} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h1 className="text-xl font-black text-slate-950">审批中心</h1><p className="mt-1 text-sm font-bold text-slate-500">统一查看待办、已办、我发起和全部 Flowable 实例。</p></div>
          <Tabs items={VIEWS} value={view} onChange={(value) => { setView(value as WorkflowLedgerView); setKeyword(''); setSearch(''); setPage(1); }} />
        </div>
      </div>
      {feedback && <FeedbackNotice tone="success" message={feedback} />}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <p className="text-sm font-black text-slate-700">{VIEWS.find((item) => item.id === view)?.label} <span className="ml-1 text-slate-400">{query.isError ? '—' : total}</span></p>
          <form className="flex w-full max-w-md gap-2" onSubmit={(event) => { event.preventDefault(); setSearch(keyword.trim()); setPage(1); }}>
            <input aria-label="搜索流程台账" maxLength={100} value={keyword} onChange={(event) => setKeyword(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-300" placeholder="业务单号、流程编号或发起人" />
            <button type="submit" aria-label="搜索" title="搜索" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"><Search size={16} /></button>
          </form>
        </div>
        {query.isError ? <div className="p-5"><FeedbackNotice tone="error" message="流程台账加载失败。" /><button type="button" onClick={() => void query.refetch()} className="mt-2 text-sm font-bold text-blue-600">重试</button></div> : query.isLoading ? <div className="p-5"><FeedbackNotice tone="info" message="正在加载流程台账…" /></div> : filtered.length === 0 ? <div className="p-5"><FeedbackNotice tone="info" message="当前台账暂无数据。" /></div> : (
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left"><thead className="bg-slate-50 text-xs font-black text-slate-500"><tr><th className="px-5 py-4">业务</th><th className="px-4 py-4">状态</th><th className="px-4 py-4">当前节点</th><th className="px-4 py-4">发起人</th><th className="px-4 py-4">金额</th><th className="px-4 py-4">更新时间</th><th className="px-5 py-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((item) => <tr key={item.workflowInstanceId} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="text-sm font-black text-slate-900">{businessLabel[item.businessType] ?? item.businessType}</p><p className="mt-1 font-mono text-xs font-bold text-slate-400">{item.businessId}</p></td><td className="px-4 py-4"><span className={cn('rounded-md px-2 py-1 text-xs font-black', item.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : item.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700')}>{statusLabel[item.status] ?? item.status}</span></td><td className="px-4 py-4 text-sm font-bold text-slate-700">{item.currentTask?.taskName ?? '—'}</td><td className="px-4 py-4 text-sm font-bold text-slate-600">{item.initiatorName ?? item.initiatorId}</td><td className="px-4 py-4 text-sm font-black text-slate-700">{item.amount == null ? '—' : `¥${item.amount.toLocaleString('zh-CN')}`}</td><td className="px-4 py-4 font-mono text-xs font-bold text-slate-500">{item.updatedAt?.slice(0, 19) ?? '—'}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelected(item)} className="text-sm font-black text-blue-600 hover:text-blue-700">{view === 'pending' ? '办理' : '详情'}</button></td></tr>)}</tbody></table></div>
        )}
        {!query.isError && !query.isLoading && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-500">
          <span>共 {total} 条 · {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</span>
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="每页条数" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-md border border-slate-200 bg-white px-2">{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} 条/页</option>)}</select>
            <button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)} className="h-9 whitespace-nowrap rounded-md border border-slate-200 px-3 disabled:opacity-40">上一页</button>
            <span aria-label="当前页码">{page} / {pages}</span>
            <button type="button" disabled={page >= pages || query.isFetching} onClick={() => setPage((value) => value + 1)} className="h-9 whitespace-nowrap rounded-md border border-slate-200 px-3 disabled:opacity-40">下一页</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
