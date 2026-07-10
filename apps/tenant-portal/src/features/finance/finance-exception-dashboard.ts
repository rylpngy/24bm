import type {
  PaymentArchiveExceptionRequestResponse,
  PaymentBatchResponse,
  PaymentBlockResolutionResponse,
  PaymentExecutionRecordResponse,
  VarianceHandlingResponse,
} from '@24bid/api-client';

export type FinanceExceptionType = '付款阻断' | '差异待处理' | '归档异常' | '逾期未登记';
export type FinanceExceptionFilter = FinanceExceptionType | '全部';
export type FinanceExceptionSeverity = 'high' | 'medium' | 'low';

export interface FinanceExceptionDashboardInput {
  paymentBatches: PaymentBatchResponse[];
  executionRecords: PaymentExecutionRecordResponse[];
  blockResolutions: PaymentBlockResolutionResponse[];
  varianceHandlings: VarianceHandlingResponse[];
  archiveExceptionRequests: PaymentArchiveExceptionRequestResponse[];
}

export interface FinanceExceptionItem {
  id: string;
  type: FinanceExceptionType;
  severity: FinanceExceptionSeverity;
  title: string;
  subtitle: string;
  amount?: number;
  reason?: string;
  nextAction?: string;
  updatedAt?: string;
}

export interface FinanceExceptionSummary {
  totalExceptions: number;
  blockedPayments: number;
  variancePending: number;
  archivePending: number;
  overdueRegistrations: number;
  blockedAmount: number;
  overdueAmount: number;
}

export interface FinanceExceptionDashboard {
  summary: FinanceExceptionSummary;
  items: FinanceExceptionItem[];
}

export interface FinanceExceptionView {
  items: FinanceExceptionItem[];
  totalCount: number;
  hiddenCount: number;
}

const n = (value?: number) => value ?? 0;
const DEFAULT_VISIBLE_EXCEPTION_COUNT = 6;

const doneStatuses = new Set(['已处理', '已完成', '已关闭', '已登记付款']);

function isOpenStatus(status?: string) {
  return !status || !doneStatuses.has(status);
}

function daysBetween(date: string, today: string) {
  const dateMs = new Date(`${date}T00:00:00`).getTime();
  const todayMs = new Date(`${today}T00:00:00`).getTime();
  return Math.floor((todayMs - dateMs) / 86_400_000);
}

function severityRank(severity: FinanceExceptionSeverity) {
  return severity === 'high' ? 0 : severity === 'medium' ? 1 : 2;
}

function typeRank(type: FinanceExceptionType) {
  return type === '付款阻断' ? 0 : type === '差异待处理' ? 1 : type === '归档异常' ? 2 : 3;
}

export function buildFinanceExceptionDashboard(
  input: FinanceExceptionDashboardInput,
  today = new Date().toISOString().slice(0, 10),
): FinanceExceptionDashboard {
  const items: FinanceExceptionItem[] = [];
  const blockByBatch = new Map(input.blockResolutions.map((resolution) => [resolution.paymentBatchNo, resolution]));
  const batchByNo = new Map(input.paymentBatches.map((batch) => [batch.paymentBatchNo, batch]));

  for (const record of input.executionRecords) {
    if (record.executionStatus !== '暂不可登记') continue;
    const batch = record.paymentBatchNo ? batchByNo.get(record.paymentBatchNo) : undefined;
    const resolution = record.paymentBatchNo ? blockByBatch.get(record.paymentBatchNo) : undefined;
    items.push({
      id: `blocked:${record.id ?? record.paymentBatchNo}`,
      type: '付款阻断',
      severity: 'high',
      title: record.paymentBatchNo ?? '未归属批次',
      subtitle: record.invoiceId ? `发票 ${record.invoiceId}` : `付款申请 ${record.paymentRequestId ?? '—'}`,
      amount: n(record.registeredAmount) || n(batch?.blockedRegistrationAmount),
      reason: record.executionBlockReason ?? resolution?.blockReason ?? batch?.executionBlockSummary,
      nextAction: resolution?.nextStep ?? record.executionNextAction ?? '处理阻断后继续登记付款',
      updatedAt: record.updatedAt,
    });
  }

  for (const handling of input.varianceHandlings) {
    if (!isOpenStatus(handling.status)) continue;
    items.push({
      id: `variance:${handling.id}`,
      type: '差异待处理',
      severity: handling.status === '待财务经理签核' ? 'high' : 'medium',
      title: handling.invoiceId ?? handling.orderId ?? '三单差异',
      subtitle: handling.orderLineId ? `行项 ${handling.lineDescription ?? handling.orderLineId}` : `订单 ${handling.orderId ?? '—'}`,
      amount: Math.abs(n(handling.varianceAmount)),
      reason: handling.reason,
      nextAction: handling.status === '待财务经理签核' ? '财务经理签核差异处理' : '核实差异并标记处理结果',
      updatedAt: handling.updatedAt,
    });
  }

  for (const request of input.archiveExceptionRequests) {
    if (!isOpenStatus(request.closureStatus) || request.closureStatus === '已关闭') continue;
    if (request.actionStatus === '已完成' && request.closureStatus === '已关闭') continue;
    items.push({
      id: `archive:${request.id}`,
      type: '归档异常',
      severity: request.approvalStatus === '待审批' ? 'medium' : 'low',
      title: request.paymentBatchNo ?? '未归属批次',
      subtitle: request.exceptionType ?? '付款归档异常',
      reason: request.exceptionReason,
      nextAction:
        request.approvalStatus === '待审批'
          ? '完成异常审批'
          : request.actionStatus === '待处理'
            ? '补齐归档动作'
            : '关闭异常申请',
      updatedAt: request.updatedAt,
    });
  }

  const blockedBatchNos = new Set(
    items.filter((item) => item.type === '付款阻断').map((item) => item.title),
  );
  for (const record of input.executionRecords) {
    if (record.executionStatus !== '待登记付款' || !record.plannedPaymentDate) continue;
    if (daysBetween(record.plannedPaymentDate, today) <= 0) continue;
    if (record.paymentBatchNo && blockedBatchNos.has(record.paymentBatchNo)) continue;
    items.push({
      id: `overdue:${record.id ?? record.paymentBatchNo}`,
      type: '逾期未登记',
      severity: daysBetween(record.plannedPaymentDate, today) >= 7 ? 'high' : 'medium',
      title: record.paymentBatchNo ?? '未归属批次',
      subtitle: record.invoiceId ? `发票 ${record.invoiceId}` : `计划付款日 ${record.plannedPaymentDate}`,
      amount: n(record.registeredAmount),
      reason: `计划付款日 ${record.plannedPaymentDate}，已逾期 ${daysBetween(record.plannedPaymentDate, today)} 天`,
      nextAction: record.executionNextAction ?? '登记付款或说明延期原因',
      updatedAt: record.updatedAt,
    });
  }

  const sortedItems = items.sort((a, b) => {
    const type = typeRank(a.type) - typeRank(b.type);
    if (type !== 0) return type;
    const rank = severityRank(a.severity) - severityRank(b.severity);
    if (rank !== 0) return rank;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  return {
    summary: {
      totalExceptions: sortedItems.length,
      blockedPayments: sortedItems.filter((item) => item.type === '付款阻断').length,
      variancePending: sortedItems.filter((item) => item.type === '差异待处理').length,
      archivePending: sortedItems.filter((item) => item.type === '归档异常').length,
      overdueRegistrations: sortedItems.filter((item) => item.type === '逾期未登记').length,
      blockedAmount: sortedItems
        .filter((item) => item.type === '付款阻断')
        .reduce((sum, item) => sum + n(item.amount), 0),
      overdueAmount: sortedItems
        .filter((item) => item.type === '逾期未登记')
        .reduce((sum, item) => sum + n(item.amount), 0),
    },
    items: sortedItems,
  };
}

export function getFinanceExceptionView(
  dashboard: FinanceExceptionDashboard,
  filter: FinanceExceptionFilter,
  expanded: boolean,
): FinanceExceptionView {
  const filteredItems =
    filter === '全部'
      ? dashboard.items
      : dashboard.items.filter((item) => item.type === filter);
  const items = expanded ? filteredItems : filteredItems.slice(0, DEFAULT_VISIBLE_EXCEPTION_COUNT);

  return {
    items,
    totalCount: filteredItems.length,
    hiddenCount: Math.max(filteredItems.length - items.length, 0),
  };
}
