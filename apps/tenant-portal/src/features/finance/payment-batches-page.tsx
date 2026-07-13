import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useBuyerFinanceActionPaymentBatches,
  useBuyerFinanceActionPaymentBlockResolutions,
  useBuyerFinanceActionPaymentExecutionRecords,
  useBuyerFinanceActionRegisterPaymentExecutionRecord,
  useBuyerFinanceActionUpdatePaymentBatchStatus,
  useBuyerFinanceActionUpdatePaymentBlockResolutionStatus,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, StatusPill } from '@24bid/ui';
import { FinanceExceptionDashboardPanel } from './finance-exception-dashboard-panel';
import {
  buildPaymentBatchExecutionSummaries,
  type PaymentBatchExecutionSummary,
} from './payment-batch-execution';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

function PaymentBatchExecutionDetails({
  summary,
  onRegister,
  onResolveBlock,
  busy,
}: {
  summary?: PaymentBatchExecutionSummary;
  onRegister: (
    executionRecordId: string,
    evidence: { releaseEvidenceNo?: string; releaseRemark?: string },
  ) => void;
  onResolveBlock: (resolutionId: string) => void;
  busy: boolean;
}) {
  // 登记付款前先展开放款证据表单;凭证号/备注选填,留空则按无证据登记。
  const [evidenceRecordId, setEvidenceRecordId] = useState<string | null>(null);
  const [evidenceNo, setEvidenceNo] = useState('');
  const [evidenceRemark, setEvidenceRemark] = useState('');

  const submitRegister = (recordId: string) => {
    onRegister(recordId, {
      releaseEvidenceNo: evidenceNo.trim() || undefined,
      releaseRemark: evidenceRemark.trim() || undefined,
    });
    setEvidenceRecordId(null);
    setEvidenceNo('');
    setEvidenceRemark('');
  };

  if (!summary || summary.totalCount === 0) {
    return (
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-black text-slate-500">执行记录明细</p>
        <p className="mt-2 text-xs font-bold text-slate-400">暂无付款执行记录。</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-slate-500">执行记录明细</p>
        <CountTag>{summary.totalCount} 笔</CountTag>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <MiniFact label="已登记明细额" value={currency(summary.registeredAmount)} />
        <MiniFact label="待登记明细额" value={currency(summary.pendingAmount)} />
        <MiniFact label="阻断明细额" value={currency(summary.blockedAmount)} />
      </div>
      <div className="mt-2 space-y-2">
        {summary.records.slice(0, 3).map((record) => (
          <div key={record.id} className="rounded-md border border-slate-100 bg-white px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {record.status && <StatusPill label={record.status} />}
                <span className="break-words font-mono text-[11px] font-black text-slate-500">
                  {record.invoiceId ? `发票 ${record.invoiceId}` : `申请 ${record.paymentRequestId ?? '—'}`}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <span className="text-xs font-black text-slate-700">{currency(record.amount)}</span>
                {record.status === '待登记付款' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setEvidenceRecordId((current) => (current === record.id ? null : record.id))
                    }
                    className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {evidenceRecordId === record.id ? '收起' : '登记付款'}
                  </button>
                )}
                {record.status === '暂不可登记' && record.resolutionId && record.resolutionStatus !== '已处理' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onResolveBlock(record.resolutionId!)}
                    className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    标记已处理
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">
              {record.evidence
                ? `放款凭证 ${record.evidence}`
                : record.explanation || record.nextAction || '暂无执行说明'}
            </p>
            {evidenceRecordId === record.id && record.status === '待登记付款' && (
              <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-2">
                <p className="text-[11px] font-black text-emerald-800">放款证据(选填)</p>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  <input
                    value={evidenceNo}
                    onChange={(e) => setEvidenceNo(e.target.value)}
                    placeholder="放款凭证号,如 BANK-20260710-001"
                    className="rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 placeholder:text-slate-300"
                  />
                  <input
                    value={evidenceRemark}
                    onChange={(e) => setEvidenceRemark(e.target.value)}
                    placeholder="放款备注,如付款流水说明"
                    className="rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 placeholder:text-slate-300"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submitRegister(record.id)}
                  className="mt-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  确认登记付款
                </button>
              </div>
            )}
            {record.nextAction && (
              <p className="mt-1 break-words text-[11px] font-bold text-slate-400">
                下一步：{record.nextAction}
              </p>
            )}
          </div>
        ))}
      </div>
      {summary.totalCount > 3 && (
        <p className="mt-2 text-xs font-bold text-slate-400">
          另有 {summary.totalCount - 3} 笔执行记录，可在合同-付款对账视图继续核验。
        </p>
      )}
    </div>
  );
}

// 付款批次:把已通过的付款申请按批次汇总,展示批次财务口径与执行登记进度。
// 作为发票付款的二级视图渲染,标题/返回由宿主页(发票付款)提供。
export function PaymentBatchesPage() {
  const queryClient = useQueryClient();
  const query = useBuyerFinanceActionPaymentBatches();
  const executions = useBuyerFinanceActionPaymentExecutionRecords();
  const blockResolutions = useBuyerFinanceActionPaymentBlockResolutions();
  const registerPayment = useBuyerFinanceActionRegisterPaymentExecutionRecord();
  const resolveBlock = useBuyerFinanceActionUpdatePaymentBlockResolutionStatus();
  const updateBatchStatus = useBuyerFinanceActionUpdatePaymentBatchStatus();
  const [actionError, setActionError] = useState<string | null>(null);
  const batches = query.data?.data ?? [];
  const executionSummaries = buildPaymentBatchExecutionSummaries(
    executions.data?.data ?? [],
    blockResolutions.data?.data ?? [],
  );
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
  const changeBatchStatus = (paymentBatchNo: string | undefined, batchStatus: string) => {
    if (!paymentBatchNo) return;
    updateBatchStatus.mutate(
      { paymentBatchNo, data: { batchStatus } },
      { onSuccess: refreshFinanceQueries, onError: reportActionError },
    );
  };
  const busy = registerPayment.isPending || resolveBlock.isPending || updateBatchStatus.isPending;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-slate-950">批量付款计划 · 执行登记 · 阻断汇总</h3>
        <CountTag>共 {batches.length} 条</CountTag>
      </div>

      {actionError && (
        <div className="mb-3">
          <FeedbackNotice tone="error" message={actionError} />
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载付款批次…" />
      ) : batches.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无付款批次。付款申请通过后按批次汇总于此。" />
      ) : (
        <div className="space-y-3">
          <FinanceExceptionDashboardPanel paymentBatches={batches} />
          {batches.map((b) => {
            const blocked = (b.blockedRegistrationCount ?? 0) > 0;
            const allRegistered =
              (b.registeredCount ?? 0) === (b.requestCount ?? 0) && (b.requestCount ?? 0) > 0;
            return (
              <div
                key={b.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">
                      {b.paymentBatchNo}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      供应商 {b.supplierId ?? '—'} · 计划付款日 {b.plannedPaymentDate ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {b.batchStatus && <StatusPill label={b.batchStatus} />}
                    <StatusPill
                      label={allRegistered ? '已全部登记' : blocked ? '存在阻断' : b.executionDecision ?? '—'}
                    />
                    {b.batchStatus !== '审批中'
                      && b.batchStatus !== '可安排付款'
                      && b.batchStatus !== '已付款归档' && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`提交批次审批 ${b.paymentBatchNo}`}
                        onClick={() => changeBatchStatus(b.paymentBatchNo, '审批中')}
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        提交批次审批
                      </button>
                    )}
                    {b.batchStatus === '审批中' && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`批次审批通过 ${b.paymentBatchNo}`}
                        onClick={() => changeBatchStatus(b.paymentBatchNo, '可安排付款')}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        审批通过
                      </button>
                    )}
                    {b.batchStatus === '可安排付款' && allRegistered && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`归档批次 ${b.paymentBatchNo}`}
                        onClick={() => changeBatchStatus(b.paymentBatchNo, '已付款归档')}
                        className="rounded-md bg-slate-700 px-2.5 py-1 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        归档批次
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniFact label="申请笔数" value={String(b.requestCount ?? '—')} />
                  <MiniFact label="批次总额" value={currency(b.totalAmount)} />
                  <MiniFact label="已审批额" value={currency(b.approvedAmount)} />
                  <MiniFact label="已登记付款额" value={currency(b.registeredAmount)} />
                </div>

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">执行登记进度</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <MiniFact
                      label="已登记"
                      value={`${b.registeredCount ?? 0} 笔 · ${currency(b.registeredAmount)}`}
                    />
                    <MiniFact
                      label="待登记"
                      value={`${b.pendingRegistrationCount ?? 0} 笔 · ${currency(b.pendingRegistrationAmount)}`}
                    />
                    <MiniFact
                      label="暂不可登记"
                      value={`${b.blockedRegistrationCount ?? 0} 笔 · ${currency(b.blockedRegistrationAmount)}`}
                    />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
                      <p className="text-[11px] font-black text-slate-400">执行结论</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {b.executionDecision ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
                      <p className="text-[11px] font-black text-slate-400">阻断原因汇总</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                        {b.executionBlockSummary ?? '暂无阻断'}
                      </p>
                    </div>
                  </div>
                </div>

                <PaymentBatchExecutionDetails
                  summary={b.paymentBatchNo ? executionSummaries.get(b.paymentBatchNo) : undefined}
                  busy={busy}
                  onRegister={(executionRecordId, evidence) =>
                    registerPayment.mutate(
                      {
                        executionRecordId,
                        data: {
                          paymentStatus: '已付款',
                          releaseEvidenceNo: evidence.releaseEvidenceNo,
                          releaseRemark: evidence.releaseRemark,
                        },
                      },
                      { onSuccess: refreshFinanceQueries, onError: reportActionError },
                    )
                  }
                  onResolveBlock={(resolutionId) =>
                    resolveBlock.mutate(
                      {
                        resolutionId,
                        data: {
                          resolutionStatus: '已处理',
                          resolutionAction: '已完成阻断处理',
                          nextStep: '可继续登记付款',
                        },
                      },
                      { onSuccess: refreshFinanceQueries, onError: reportActionError },
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
