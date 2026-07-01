import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, FileWarning, Scale, TimerReset } from 'lucide-react';
import {
  useBuyerFinanceActionPaymentArchiveExceptionRequests,
  useBuyerFinanceActionPaymentBlockResolutions,
  useBuyerFinanceActionPaymentExecutionRecords,
  useBuyerFinanceActionVarianceHandlings,
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

function ExceptionCard({ item }: { item: FinanceExceptionItem }) {
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
    </div>
  );
}

export function FinanceExceptionDashboardPanel({ paymentBatches }: { paymentBatches: PaymentBatchResponse[] }) {
  const [filter, setFilter] = useState<FinanceExceptionFilter>('全部');
  const [expanded, setExpanded] = useState(false);
  const executions = useBuyerFinanceActionPaymentExecutionRecords();
  const blockResolutions = useBuyerFinanceActionPaymentBlockResolutions();
  const variances = useBuyerFinanceActionVarianceHandlings();
  const archiveExceptions = useBuyerFinanceActionPaymentArchiveExceptionRequests();

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
        <StatusPill label={dashboard.summary.totalExceptions > 0 ? `${dashboard.summary.totalExceptions} 项待处理` : '暂无异常'} />
      </div>

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
                  {view.items.map((item) => (
                    <ExceptionCard key={item.id} item={item} />
                  ))}
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
    </div>
  );
}
