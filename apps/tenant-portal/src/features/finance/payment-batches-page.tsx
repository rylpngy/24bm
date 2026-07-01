import { Banknote } from 'lucide-react';
import {
  useBuyerFinanceActionPaymentBatches,
  useBuyerFinanceActionPaymentExecutionRecords,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, Panel, StatusPill } from '@24bid/ui';
import { FinanceExceptionDashboardPanel } from './finance-exception-dashboard-panel';
import {
  buildPaymentBatchExecutionSummaries,
  type PaymentBatchExecutionSummary,
} from './payment-batch-execution';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

function PaymentBatchExecutionDetails({
  summary,
}: {
  summary?: PaymentBatchExecutionSummary;
}) {
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
              <span className="text-xs font-black text-slate-700">{currency(record.amount)}</span>
            </div>
            <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">
              {record.evidence
                ? `放款凭证 ${record.evidence}`
                : record.explanation || record.nextAction || '暂无执行说明'}
            </p>
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
export function PaymentBatchesPage() {
  const query = useBuyerFinanceActionPaymentBatches();
  const executions = useBuyerFinanceActionPaymentExecutionRecords();
  const batches = query.data?.data ?? [];
  const executionSummaries = buildPaymentBatchExecutionSummaries(executions.data?.data ?? []);

  return (
    <Panel title="付款批次" icon={Banknote} subtitle="批量付款计划 · 执行登记 · 阻断汇总">
      <div className="mb-4">
        <CountTag>共 {batches.length} 条</CountTag>
      </div>

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
                />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
