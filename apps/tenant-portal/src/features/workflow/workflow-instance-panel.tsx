import { useState } from 'react';
import { ExternalLink, FileText, History, Paperclip, Workflow } from 'lucide-react';
import {
  axiosInstance,
  type WorkflowInstanceHistory,
  useWorkflowBusinessHistory,
} from '@24bid/api-client';
import { FeedbackNotice, StatusPill } from '@24bid/ui';

const statusLabel: Record<string, string> = {
  processing: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
};

const eventLabel: Record<string, string> = {
  created: '任务创建',
  claimed: '任务领取',
  approved: '审批通过',
  rejected: '审批驳回',
  completed: '任务完成',
};

export function WorkflowStatusPanel({
  businessType,
  businessId,
  compact = false,
  hideBusinessSnapshot = false,
}: {
  businessType: string;
  businessId: string;
  compact?: boolean;
  hideBusinessSnapshot?: boolean;
}) {
  const query = useWorkflowBusinessHistory(businessType, businessId);
  if (query.isLoading) return <FeedbackNotice tone="info" message="正在读取流程状态…" />;
  if (query.isError) return <FeedbackNotice tone="error" message="流程状态加载失败，请刷新后重试。" />;
  const history = query.data?.data;
  if (!history) return <FeedbackNotice tone="info" message="该业务尚未发起审批流程。" />;
  return <WorkflowInstancePanel history={history} compact={compact} hideBusinessSnapshot={hideBusinessSnapshot} />;
}

export function WorkflowInstancePanel({
  history,
  compact = false,
  hideBusinessSnapshot = false,
}: {
  history: WorkflowInstanceHistory;
  compact?: boolean;
  hideBusinessSnapshot?: boolean;
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const snapshotEntries = hideBusinessSnapshot ? [] : visibleEntries(history.businessSnapshot).filter(([key])=>history.businessType!=='order_settlement'||key!=='settlementSnapshot');
  const formEntries = visibleEntries(history.formData);
  const formLabels = workflowFormLabels(history.formSchema);
  const detailHref = workflowBusinessHref(history);

  const download = async (id: string, fileName: string) => {
    setDownloadError(null);
    try {
      const response = await axiosInstance.get(`/api/v1/buyer/attachments/${id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('附件下载失败，请重试。');
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Workflow size={16} className="text-blue-600" /> 审批流程
          </p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {history.initiatorName ?? history.initiatorId} 发起 · {history.createdAt?.slice(0, 19) ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill label={statusLabel[history.status] ?? history.status} />
          {detailHref && (
            <a href={detailHref} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-black text-blue-700 hover:bg-blue-50">
              业务详情 <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Fact label="当前节点" value={history.currentTask?.taskName ?? (history.status === 'processing' ? '等待流转' : '流程已结束')} />
        <Fact label="当前办理人" value={currentHandler(history)} />
        <Fact label="完成人" value={history.completedByName ?? history.completedBy ?? '—'} />
      </div>

      {!compact && (snapshotEntries.length > 0 || formEntries.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ContextBlock title="业务快照" icon={FileText} entries={snapshotEntries} />
          <ContextBlock title="审批表单" icon={FileText} entries={formEntries} labels={formLabels} />
        </div>
      )}
      {!compact&&!hideBusinessSnapshot&&history.businessType==='order_settlement'&&<SettlementSnapshot snapshot={history.businessSnapshot?.settlementSnapshot}/>}

      {!compact && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-black text-slate-600"><History size={13} /> 完整流转记录</p>
            <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4">
              {history.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-slate-50" />
                  <p className="text-xs font-black text-slate-700">{eventLabel[event.action] ?? event.action} · {event.nodeName ?? '流程节点'}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{event.actorName ?? event.actorId ?? '系统'} · {event.createdAt?.slice(0, 19) ?? '—'}</p>
                  {event.comment && <p className="mt-1 text-xs font-semibold text-slate-600">{event.comment}</p>}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-black text-slate-600"><Paperclip size={13} /> 关联附件</p>
            {downloadError && <div className="mt-2"><FeedbackNotice tone="error" message={downloadError} /></div>}
            <div className="mt-3 space-y-2">
              {history.attachments.map((attachment) => (
                <button key={attachment.id} type="button" onClick={() => download(attachment.id, attachment.fileName)} className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700">
                  <span className="truncate">{attachment.fileName}</span><span className="shrink-0 text-slate-400">下载</span>
                </button>
              ))}
              {history.attachments.length === 0 && <p className="text-xs font-bold text-slate-400">暂无关联附件。</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SettlementSnapshot({snapshot}:{snapshot:unknown}){
  const record=(x:unknown):Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
  const assessment=record(record(snapshot).assessment),raw=assessment.lines;
  const lines=Array.isArray(raw)?raw.map(record):[];
  return <div className="mt-4 min-w-0 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><caption className="mb-2 text-left font-bold text-slate-700">送审清算行明细</caption><thead className="bg-slate-50 text-slate-500"><tr>{['货物','原数量','保留数量','终止数量','原单价','清算单价'].map(t=><th key={t} className="whitespace-nowrap px-3 py-2">{t}</th>)}</tr></thead><tbody>{lines.map((l,i)=><tr key={String(l.id??i)} className="border-b border-slate-100">{[l.description,l.quantity,l.retainedQuantity,l.cancelledQuantity,l.unitPrice,l.settlementUnitPrice].map((value,j)=><td key={j} className="px-3 py-2 text-slate-700">{String(value??'—')}</td>)}</tr>)}</tbody></table></div>;
}

function ContextBlock({ title, icon: Icon, entries, labels }: { title: string; icon: React.ElementType; entries: Array<[string, unknown]>; labels?: Map<string, string> }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-black text-slate-600"><Icon size={13} /> {title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => <Fact key={key} label={labels?.get(key) ?? fieldLabel(key)} value={displayValue(value)} />)}
        {entries.length === 0 && <p className="text-xs font-bold text-slate-400">无额外信息。</p>}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-md border border-slate-100 bg-white px-3 py-2"><p className="break-words text-[11px] font-black text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs font-black text-slate-700 [overflow-wrap:anywhere]">{value}</p></div>;
}

export function workflowFormLabels(schema?: string): Map<string, string> {
  const labels = new Map<string, string>();
  try {
    const parsed = JSON.parse(schema ?? '{}');
    if (!Array.isArray(parsed?.fields)) return labels;
    for (const field of parsed.fields) {
      if (typeof field?.id === 'string' && typeof field.label === 'string' && field.label.trim()) {
        labels.set(field.id, field.label);
      }
    }
  } catch {
    // Legacy records remain readable even when their schema is unavailable.
  }
  return labels;
}

function currentHandler(history: WorkflowInstanceHistory) {
  const task = history.currentTask;
  if (!task) return '—';
  if (task.assigneeId) return task.assigneeId;
  const candidates = [...task.candidateUserIds, ...task.candidateRoleIds.map((id) => `角色:${id}`)];
  return candidates.join('、') || '动态分配';
}

function visibleEntries(value: Record<string, unknown> | undefined) {
  return Object.entries(value ?? {}).filter(([, item]) => item != null && item !== '');
}

function displayValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map(displayValue).join('、');
  if (typeof value === 'object' && value != null) return JSON.stringify(value);
  return String(value ?? '—');
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    departmentId: '部门', period: '预算年度', kind: '申请类型', baseAmount: '原生效额度',
    targetAmount: '申请额度或例外占用上限', reason: '申请依据', targetType: '例外业务类型', targetId: '例外业务编号',
    occupiedAtSubmission: '提交时已有占用', remainingAtSubmission: '提交时可用余额', controlMode: '提交时控制模式', exceptionValidityDays: '例外有效天数',
    title: '标题', budget: '预算', priority: '优先级', purpose: '用途', expectedDeliveryDate: '期望交付日期',
    supplierId: '供应商编号', supplierName: '供应商名称', rfqId: '询价编号', quoteId: '报价编号',
    relationId: '合作关系', qualificationId: '新版证照编号', previousId: '旧版证照编号', qualificationReviewId: '变更复核编号',
    qualificationType: '资质类型', certificateNo: '证书编号', expiresAt: '有效期至', fileName: '原件名称', contentSha256: '原件SHA256',
    exitReason: '退出原因', unreceivedOrderCount: '未收货订单数', unpaidInvoiceCount: '未付清发票数',
    contractNo: '合同编号', contractName: '合同名称', invoiceId: '发票编号', orderId: '订单编号', paymentBatchNo: '付款批次',
    exceptionType: '例外类型', exceptionReason: '例外原因', amount: '金额', requestCount: '申请数量', totalAmount: '总金额',
    contractId:'合同编号',finalAmount:'约定清算总额',goodsAmount:'结算货款',initialPaid:'原已付款',
  };
  return labels[key] ?? key;
}

export function workflowBusinessHref(history: Pick<WorkflowInstanceHistory, 'businessType' | 'businessId' | 'businessSnapshot'>) {
  const snapshot = history.businessSnapshot ?? {};
  const target: Record<string, { module: string; id: unknown }> = {
    budget_change: { module: 'budgets', id: history.businessId },
    project_initiation: { module: 'projects', id: history.businessId },
    project_change: { module: 'projects', id: snapshot.projectId },
    project_carryover: { module: 'projects', id: snapshot.projectId },
    project_liquidation: { module: 'projects', id: snapshot.projectId },
    order_settlement: { module: 'orders', id: snapshot.orderId },
    frozen_payment_correction: { module: 'invoices', id: snapshot.invoiceId },
    funding_change: { module: snapshot.projectId ? 'projects' : 'budgets', id: snapshot.projectId || snapshot.fundId },
    budget_exception: { module: 'budgets', id: history.businessId },
    supplier_qualification_change: { module: 'suppliers', id: snapshot.relationId },
    purchase_demand: { module: 'demands', id: history.businessId },
    buyer_supplier_admission: { module: 'suppliers', id: history.businessId },
    buyer_supplier_exit: { module: 'suppliers', id: history.businessId },
    rfq_award: { module: 'rfqs', id: snapshot.rfqId },
    contract_approval: { module: 'contracts', id: history.businessId },
    payment_request: { module: 'invoices', id: snapshot.invoiceId },
    payment_batch: { module: 'invoices', id: history.businessId },
    payment_archive_exception: { module: 'invoices', id: snapshot.paymentBatchNo },
  };
  const item = target[history.businessType];
  if (!item) return null;
  const params = new URLSearchParams({ module: item.module });
  if (item.id != null && String(item.id)) params.set('recordId', String(item.id));
  if (history.businessType === 'supplier_qualification_change') params.set('tab', 'qualifications');
  if (history.businessType === 'project_change') params.set('changeId', history.businessId);
  return `/?${params.toString()}`;
}
