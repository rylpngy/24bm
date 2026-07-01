import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Link2, ReceiptText } from 'lucide-react';
import {
  getContractScheduleMilestonesQueryOptions,
  useBuyerFinanceActionPaymentBatches,
  useBuyerFinanceActionPaymentExecutionRecords,
  useBuyerFinanceActionPaymentRequests,
  type ContractResponse,
  type ContractPaymentMilestoneResponse,
  type PaymentExecutionRecordResponse,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, StatusPill } from '@24bid/ui';
import {
  buildContractPaymentReconciliation,
  filterContractReconciliations,
  summarizeContractReconciliations,
  type ContractPaymentReconciliation,
  type ReconciliationFilter,
  type ReconciliationStatus,
} from './contract-payment-reconciliation';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const statusClass: Record<ReconciliationStatus, string> = {
  待建立付款申请: 'bg-slate-100 text-slate-600',
  存在付款阻断: 'bg-red-100 text-red-700',
  已完成付款登记: 'bg-emerald-100 text-emerald-700',
  里程碑达成待付款: 'bg-amber-100 text-amber-700',
  付款申请未覆盖合同: 'bg-blue-100 text-blue-700',
  对账正常: 'bg-emerald-100 text-emerald-700',
};

const statusIcon: Partial<Record<ReconciliationStatus, typeof AlertTriangle>> = {
  存在付款阻断: AlertTriangle,
  已完成付款登记: CheckCircle2,
  对账正常: CheckCircle2,
};

const filters: ReconciliationFilter[] = [
  '全部',
  '存在付款阻断',
  '里程碑达成待付款',
  '付款申请未覆盖合同',
  '已完成付款登记',
];

type ExecutionRecordWithReleaseEvidence = PaymentExecutionRecordResponse & {
  releaseEvidenceNo?: string;
  releaseRemark?: string;
};

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  const Icon = statusIcon[status] ?? ReceiptText;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black ${statusClass[status]}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}

function progressWidth(value: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.min(100, Math.max(0, (value / total) * 100)).toFixed(0)}%`;
}

function ReconciliationProgress({ result }: { result: ContractPaymentReconciliation }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-400">
        <span>合同付款登记覆盖</span>
        <span>{progressWidth(result.registeredAmount, result.contractAmount)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: progressWidth(result.registeredAmount, result.contractAmount) }}
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniFact label="合同金额" value={currency(result.contractAmount)} />
        <MiniFact label="已登记付款" value={currency(result.registeredAmount)} />
        <MiniFact label="未登记差额" value={currency(result.unregisteredContractAmount)} />
      </div>
    </div>
  );
}

function SummaryGrid({ rows }: { rows: ContractPaymentReconciliation[] }) {
  const summary = summarizeContractReconciliations(rows);

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      <MiniFact label="合同总额" value={currency(summary.contractAmount)} />
      <MiniFact label="已申请" value={currency(summary.paymentRequestAmount)} />
      <MiniFact label="已审批" value={currency(summary.approvedRequestAmount)} />
      <MiniFact label="已登记" value={currency(summary.registeredAmount)} />
      <MiniFact label="阻断笔数" value={`${summary.blockedCount} 笔`} />
      <MiniFact label="待核差额" value={currency(summary.unregisteredContractAmount)} />
    </div>
  );
}

function FilterBar({
  active,
  rows,
  onChange,
}: {
  active: ReconciliationFilter;
  rows: ContractPaymentReconciliation[];
  onChange: (filter: ReconciliationFilter) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {filters.map((filter) => {
        const count = filterContractReconciliations(rows, filter).length;
        const activeClass =
          active === filter
            ? 'border-emerald-600 bg-emerald-700 text-white'
            : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50';
        return (
          <button
            type="button"
            key={filter}
            onClick={() => onChange(filter)}
            className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-black transition ${activeClass}`}
          >
            {filter}
            <span className={active === filter ? 'text-emerald-100' : 'text-emerald-500'}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ContractReconciliationCard({
  contract,
  result,
  milestonesLoading,
  executionRecords,
}: {
  contract: ContractResponse;
  result: ContractPaymentReconciliation;
  milestonesLoading: boolean;
  executionRecords: PaymentExecutionRecordResponse[];
}) {
  const relatedExecutions = executionRecords.filter(
    (record) => record.paymentBatchNo && result.paymentBatchNos.includes(record.paymentBatchNo),
  ) as ExecutionRecordWithReleaseEvidence[];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-black text-slate-950">{contract.contractName}</p>
            <StatusBadge status={result.status} />
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-slate-500">
            {contract.contractNo ?? '—'} · 订单 {contract.relatedOrderId ?? '—'}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {contract.status && <StatusPill label={contract.status} />}
          {contract.archiveStatus && <StatusPill label={contract.archiveStatus} />}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <ReconciliationProgress result={result} />

        <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-black text-slate-400">付款链路</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <MiniFact label="付款申请" value={`${result.paymentRequestCount} 笔 · ${currency(result.paymentRequestAmount)}`} />
            <MiniFact label="已通过申请" value={currency(result.approvedRequestAmount)} />
            <MiniFact label="付款批次" value={result.paymentBatchNos.join('、') || '—'} />
            <MiniFact label="阻断笔数" value={`${result.blockedCount} 笔`} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-black text-slate-400">里程碑口径</p>
          {milestonesLoading ? (
            <p className="mt-2 text-xs font-bold text-slate-400">正在加载付款计划…</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <MiniFact label="计划金额" value={currency(result.milestoneAmount)} />
              <MiniFact label="里程碑已付" value={currency(result.milestonePaidAmount)} />
              <MiniFact label="达成待付" value={currency(result.reachedUnpaidAmount)} />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-black text-slate-400">执行证据与阻断</p>
          {relatedExecutions.length === 0 ? (
            <p className="mt-2 text-xs font-bold text-slate-500">暂无付款执行记录。</p>
          ) : (
            <div className="mt-2 space-y-2">
              {relatedExecutions.slice(0, 2).map((record) => (
                <div key={record.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-black text-slate-500">
                      {record.paymentBatchNo ?? '—'}
                    </span>
                    {record.executionStatus && <StatusPill label={record.executionStatus} />}
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-700">
                    {record.releaseEvidenceNo
                      ? `放款凭证 ${record.releaseEvidenceNo}`
                      : record.executionBlockReason || record.executionNextAction || record.executionTrace || '暂无执行说明'}
                  </p>
                  {record.releaseRemark && (
                    <p className="mt-1 text-[11px] font-bold text-slate-400">{record.releaseRemark}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {result.blockReasons.length > 0 && (
            <p className="mt-2 break-words text-xs font-black text-red-600">
              阻断原因：{result.blockReasons.join('、')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContractPaymentReconciliationPanel({ contracts }: { contracts: ContractResponse[] }) {
  const [activeFilter, setActiveFilter] = useState<ReconciliationFilter>('全部');
  const requests = useBuyerFinanceActionPaymentRequests();
  const batches = useBuyerFinanceActionPaymentBatches();
  const executions = useBuyerFinanceActionPaymentExecutionRecords();
  const paymentRequests = requests.data?.data ?? [];
  const paymentBatches = batches.data?.data ?? [];
  const executionRecords = executions.data?.data ?? [];
  const milestoneQueries = useQueries({
    queries: contracts.map((contract) => ({
      ...getContractScheduleMilestonesQueryOptions(contract.id ?? ''),
      enabled: Boolean(contract.id),
    })),
  });
  const milestonesByContractId = useMemo(() => {
    const entries = contracts.map((contract, index) => [
      contract.id,
      (milestoneQueries[index]?.data?.data ?? []) as ContractPaymentMilestoneResponse[],
    ]);
    return new Map(entries.filter((entry): entry is [string, ContractPaymentMilestoneResponse[]] => Boolean(entry[0])));
  }, [contracts, milestoneQueries]);
  const milestonesLoading = milestoneQueries.some((query) => query.isLoading);
  const loading = requests.isLoading || batches.isLoading || executions.isLoading || milestonesLoading;
  const rows = useMemo(
    () =>
      contracts.map((contract) => ({
        contract,
        result: buildContractPaymentReconciliation({
          contract,
          milestones: contract.id ? (milestonesByContractId.get(contract.id) ?? []) : [],
          paymentRequests,
          paymentBatches,
          executionRecords,
        }),
      })),
    [contracts, milestonesByContractId, paymentRequests, paymentBatches, executionRecords],
  );
  const filteredRows = filterContractReconciliations(
    rows.map((row) => row.result),
    activeFilter,
  );
  const visibleRows = rows.filter((row) => filteredRows.includes(row.result));

  return (
    <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-emerald-700" />
            <p className="text-sm font-black text-emerald-900">合同-付款对账视图</p>
          </div>
          <p className="mt-1 text-xs font-bold text-emerald-700">
            按关联订单串联合同、里程碑、付款申请、批次与执行记录。
          </p>
        </div>
        <CountTag>合同 {contracts.length} 份 · 批次 {paymentBatches.length} 个</CountTag>
      </div>

      {loading ? (
        <div className="mt-3">
          <FeedbackNotice tone="info" message="正在加载付款对账数据…" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="mt-3">
          <FeedbackNotice tone="info" message="暂无合同可对账。" />
        </div>
      ) : (
        <>
          <SummaryGrid rows={rows.map((row) => row.result)} />
          <FilterBar active={activeFilter} rows={rows.map((row) => row.result)} onChange={setActiveFilter} />
          <div className="mt-3 space-y-3">
            {visibleRows.length === 0 ? (
              <FeedbackNotice tone="info" message="当前筛选下暂无合同。" />
            ) : (
              visibleRows.map(({ contract, result }) => (
                <ContractReconciliationCard
                  key={contract.id}
                  contract={contract}
                  result={result}
                  milestonesLoading={milestonesLoading}
                  executionRecords={executionRecords}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
