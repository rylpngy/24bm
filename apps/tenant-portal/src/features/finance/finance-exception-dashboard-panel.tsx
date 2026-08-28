import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, FileWarning, Scale, TimerReset } from 'lucide-react';
import {
  useBuyerFinanceActionClosePaymentArchiveExceptionRequest,
  useBuyerFinanceActionCompletePaymentArchiveExceptionAction,
  useBuyerFinanceActionPaymentArchiveExceptionRequests,
  useBuyerFinanceActionPaymentBlockResolutions,
  useBuyerFinanceActionPaymentExecutionRecords,
  useBuyerFinanceActionReviewPaymentArchiveExceptionRequest,
  useBuyerFinanceActionVarianceHandlings,
  useWorkflowPaymentArchiveExceptionCreate,
  type PaymentArchiveExceptionRequestResponse,
  type PaymentBatchResponse,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, StatusPill } from '@24bid/ui';
import {
  buildFinanceExceptionDashboard,
  getFinanceExceptionView,
  type FinanceExceptionFilter,
  type FinanceExceptionItem,
  type FinanceExceptionType,
} from './finance-exception-dashboard';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const typeIcon: Record<FinanceExceptionType, typeof AlertTriangle> = {
  付款阻断: AlertTriangle,
  差异待处理: Scale,
  归档异常: FileWarning,
  逾期未登记: TimerReset,
};

const filters: FinanceExceptionFilter[] = ['全部', '付款阻断', '差异待处理', '归档异常', '逾期未登记'];

const severityTone = {
  high: 'border-red-200 bg-red-50/70 text-red-800',
  medium: 'border-amber-200 bg-amber-50/70 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

function ExceptionCard({ item, actions }: { item: FinanceExceptionItem; actions?: ReactNode }) {
  const Icon = typeIcon[item.type];
  return (
    <div className={`rounded-lg border p-3 ${severityTone[item.severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon size={14} />
            <p className="break-words font-mono text-xs font-black">{item.title}</p>
            <StatusPill label={item.type} />
          </div>
          <p className="mt-1 break-words text-xs font-bold opacity-80">{item.subtitle}</p>
        </div>
        <p className="shrink-0 text-xs font-black">{currency(item.amount)}</p>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-white/70 bg-white/60 p-2">
          <p className="text-[11px] font-black opacity-60">原因</p>
          <p className="mt-1 break-words text-xs font-bold">{item.reason ?? '—'}</p>
        </div>
        <div className="rounded-md border border-white/70 bg-white/60 p-2">
          <p className="text-[11px] font-black opacity-60">下一步</p>
          <p className="mt-1 break-words text-xs font-bold">{item.nextAction ?? '—'}</p>
        </div>
      </div>
      {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const actionButtonClass =
  'rounded-md px-2.5 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300';

// 归档异常处置动作:待审批→通过/驳回;已通过→登记受控处理→关闭申请。
function ArchiveExceptionActions({
  request,
  busy,
  onReview,
  onCompleteAction,
  onClose,
}: {
  request: PaymentArchiveExceptionRequestResponse;
  busy: boolean;
  onReview: (requestId: string, approved: boolean) => void;
  onCompleteAction: (requestId: string) => void;
  onClose: (requestId: string) => void;
}) {
  if (!request.id) return null;
  const requestId = request.id;
  if (request.approvalStatus === '待审批') {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => onReview(requestId, true)}
          className={`${actionButtonClass} bg-emerald-600`}
        >
          审批通过
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onReview(requestId, false)}
          className={`${actionButtonClass} bg-red-600`}
        >
          驳回
        </button>
      </>
    );
  }
  if (request.approvalStatus === '已通过' && request.actionStatus === '待处理') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onCompleteAction(requestId)}
        className={`${actionButtonClass} bg-blue-600`}
      >
        登记受控处理
      </button>
    );
  }
  if (
    request.approvalStatus === '已通过'
    && request.actionStatus === '已登记受控处理'
    && request.closureStatus !== '已关闭'
  ) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onClose(requestId)}
        className={`${actionButtonClass} bg-slate-700`}
      >
        关闭异常申请
      </button>
    );
  }
  return null;
}

export function FinanceExceptionDashboardPanel({ paymentBatches }: { paymentBatches: PaymentBatchResponse[] }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FinanceExceptionFilter>('全部');
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [archiveExceptionDraft, setArchiveExceptionDraft] = useState<{
    paymentBatchNo: string;
    exceptionType: string;
    exceptionReason: string;
  } | null>(null);
  const executions = useBuyerFinanceActionPaymentExecutionRecords();
  const blockResolutions = useBuyerFinanceActionPaymentBlockResolutions();
  const variances = useBuyerFinanceActionVarianceHandlings();
  const archiveExceptions = useBuyerFinanceActionPaymentArchiveExceptionRequests();
  const reviewArchiveException = useBuyerFinanceActionReviewPaymentArchiveExceptionRequest();
  const completeArchiveAction = useBuyerFinanceActionCompletePaymentArchiveExceptionAction();
  const closeArchiveException = useBuyerFinanceActionClosePaymentArchiveExceptionRequest();
  const createArchiveException = useWorkflowPaymentArchiveExceptionCreate();
  const archivedBatches = paymentBatches.filter(
    (batch) => batch.batchStatus === '已付款归档' && Boolean(batch.paymentBatchNo),
  );

  const archiveRequestsById = new Map(
    (archiveExceptions.data?.data ?? []).map((request) => [`archive:${request.id}`, request]),
  );
  const archiveBusy =
    reviewArchiveException.isPending
    || completeArchiveAction.isPending
    || closeArchiveException.isPending
    || createArchiveException.isPending;
  const refreshFinanceQueries = () => {
    setActionError(null);
    queryClient.invalidateQueries({
      predicate: (cachedQuery) =>
        String(cachedQuery.queryKey[0] ?? '').includes('/api/v1/buyer/payment'),
    });
  };
  const reportActionError = (error: unknown) => {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (error as Error)?.message ??
      '操作失败,请稍后重试';
    setActionError(message);
  };
  const mutationHandlers = { onSuccess: refreshFinanceQueries, onError: reportActionError };

  const loading =
    executions.isLoading ||
    blockResolutions.isLoading ||
    variances.isLoading ||
    archiveExceptions.isLoading;

  const dashboard = buildFinanceExceptionDashboard({
    paymentBatches,
    executionRecords: executions.data?.data ?? [],
    blockResolutions: blockResolutions.data?.data ?? [],
    varianceHandlings: variances.data?.data ?? [],
    archiveExceptionRequests: archiveExceptions.data?.data ?? [],
  });
  const view = getFinanceExceptionView(dashboard, filter, expanded);

  const filterCount = (itemFilter: FinanceExceptionFilter) =>
    itemFilter === '全部'
      ? dashboard.items.length
      : dashboard.items.filter((item) => item.type === itemFilter).length;

  const chooseFilter = (itemFilter: FinanceExceptionFilter) => {
    setFilter(itemFilter);
    setExpanded(false);
  };

  return (
    <div className="mb-4 rounded-lg border border-red-100 bg-red-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-red-700" />
          <div>
            <p className="text-sm font-black text-red-900">财务异常看板</p>
            <p className="mt-1 text-xs font-bold text-red-700">
              阻断付款、三单差异、归档异常与逾期未登记。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {archivedBatches.length > 0 && (
            <button
              type="button"
              disabled={archiveBusy}
              onClick={() =>
                setArchiveExceptionDraft({
                  paymentBatchNo: archivedBatches[0].paymentBatchNo!,
                  exceptionType: '归档资料缺失',
                  exceptionReason: '',
                })
              }
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-800 hover:border-red-300 disabled:opacity-50"
            >
              申请归档例外
            </button>
          )}
          <StatusPill label={dashboard.summary.totalExceptions > 0 ? `${dashboard.summary.totalExceptions} 项待处理` : '暂无异常'} />
        </div>
      </div>

      {actionError && (
        <div className="mt-3">
          <FeedbackNotice tone="error" message={actionError} />
        </div>
      )}

      {loading ? (
        <div className="mt-3">
          <FeedbackNotice tone="info" message="正在加载财务异常…" />
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <MiniFact label="待处理异常" value={`${dashboard.summary.totalExceptions} 项`} />
            <MiniFact label="付款阻断" value={`${dashboard.summary.blockedPayments} 项`} />
            <MiniFact label="差异待处理" value={`${dashboard.summary.variancePending} 项`} />
            <MiniFact label="归档异常" value={`${dashboard.summary.archivePending} 项`} />
            <MiniFact label="逾期未登记" value={`${dashboard.summary.overdueRegistrations} 项`} />
            <MiniFact label="阻断金额" value={currency(dashboard.summary.blockedAmount)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filters.map((itemFilter) => {
              const active = itemFilter === filter;
              return (
                <button
                  key={itemFilter}
                  type="button"
                  onClick={() => chooseFilter(itemFilter)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-black transition ${
                    active
                      ? 'border-red-700 bg-red-700 text-white'
                      : 'border-red-100 bg-white/80 text-red-800 hover:border-red-300'
                  }`}
                >
                  {itemFilter} {filterCount(itemFilter)}
                </button>
              );
            })}
          </div>

          {dashboard.items.length === 0 ? (
            <div className="mt-3">
              <FeedbackNotice tone="success" message="当前无财务异常，付款批次可按计划推进。" />
            </div>
          ) : (
            <>
              {view.items.length === 0 ? (
                <div className="mt-3">
                  <FeedbackNotice tone="info" message="当前分类暂无待处理异常。" />
                </div>
              ) : (
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {view.items.map((item) => {
                    const archiveRequest =
                      item.type === '归档异常' ? archiveRequestsById.get(item.id) : undefined;
                    return (
                      <div key={item.id} className="space-y-2">
                        <ExceptionCard
                          item={item}
                          actions={
                          archiveRequest && (
                            <ArchiveExceptionActions
                              request={archiveRequest}
                              busy={archiveBusy}
                              onReview={(requestId, approved) =>
                                reviewArchiveException.mutate(
                                  { requestId, data: { approved, comment: approved ? '同意归档异常处理' : '驳回归档异常申请' } },
                                  mutationHandlers,
                                )
                              }
                              onCompleteAction={(requestId) =>
                                completeArchiveAction.mutate(
                                  { requestId, data: { actionResult: '已按受控流程补齐归档动作' } },
                                  mutationHandlers,
                                )
                              }
                              onClose={(requestId) =>
                                closeArchiveException.mutate(
                                  { requestId, data: { closureResult: '异常已处置完毕,关闭申请' } },
                                  mutationHandlers,
                                )
                              }
                            />
                          )
                          }
                        />
                        {archiveRequest?.id && (
                          <WorkflowStatusPanel compact businessType="payment_archive_exception" businessId={archiveRequest.id} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(view.hiddenCount > 0 || expanded) && view.totalCount > 6 ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-800 hover:border-red-300"
                  >
                    {expanded ? '收起' : `展开 ${view.hiddenCount} 项`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
      {archiveExceptionDraft && (
        <WorkflowSubmitDialog
          businessType="payment_archive_exception"
          title={`归档例外 · ${archiveExceptionDraft.paymentBatchNo}`}
          busy={createArchiveException.isPending}
          submissionError={createArchiveException.error}
          onClose={() => setArchiveExceptionDraft(null)}
          onSubmit={(formData) => {
            const exceptionReason = archiveExceptionDraft.exceptionReason.trim();
            if (!exceptionReason) {
              setActionError('请填写归档例外原因后再提交。');
              return;
            }
            createArchiveException.mutate(
              { ...archiveExceptionDraft, exceptionReason, formData },
              {
                onSuccess: () => {
                  setArchiveExceptionDraft(null);
                  refreshFinanceQueries();
                },
                onError: reportActionError,
              },
            );
          }}
        >
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <label className="block text-xs font-black text-slate-600">
              付款批次<span className="ml-1 text-red-500">*</span>
              <select
                value={archiveExceptionDraft.paymentBatchNo}
                onChange={(event) => setArchiveExceptionDraft((current) => current && ({ ...current, paymentBatchNo: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {archivedBatches.map((batch) => (
                  <option key={batch.paymentBatchNo} value={batch.paymentBatchNo}>
                    {batch.paymentBatchNo}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-black text-slate-600">
              例外类型<span className="ml-1 text-red-500">*</span>
              <select
                value={archiveExceptionDraft.exceptionType}
                onChange={(event) => setArchiveExceptionDraft((current) => current && ({ ...current, exceptionType: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="归档资料缺失">归档资料缺失</option>
                <option value="凭证补正">凭证补正</option>
                <option value="系统数据更正">系统数据更正</option>
              </select>
            </label>
            <label className="block text-xs font-black text-slate-600">
              例外原因<span className="ml-1 text-red-500">*</span>
              <textarea
                value={archiveExceptionDraft.exceptionReason}
                onChange={(event) => setArchiveExceptionDraft((current) => current && ({ ...current, exceptionReason: event.target.value }))}
                placeholder="说明例外原因、补正措施和责任人"
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </WorkflowSubmitDialog>
      )}
    </div>
  );
}
