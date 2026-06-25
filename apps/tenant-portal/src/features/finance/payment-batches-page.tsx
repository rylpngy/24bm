import { Banknote } from 'lucide-react';
import { useBuyerFinanceActionPaymentBatches } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 付款批次:把已通过的付款申请按批次汇总,展示批次财务口径与执行登记进度。
export function PaymentBatchesPage() {
  const query = useBuyerFinanceActionPaymentBatches();
  const batches = query.data?.data ?? [];

  return (
    <Panel title="付款批次" icon={Banknote} subtitle="批量付款计划 · 执行登记 · 阻断汇总">
      <ListToolbar
        title="付款批次"
        recordCount={batches.length}
        filterLabel="全部"
        actionLabel="按计划付款日排序"
      />

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载付款批次…" />
      ) : batches.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无付款批次。付款申请通过后按批次汇总于此。" />
      ) : (
        <div className="space-y-3">
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
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
