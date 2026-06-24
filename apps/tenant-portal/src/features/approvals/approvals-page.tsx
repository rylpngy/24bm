import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import {
  useApprovalInboxPending,
  useApprovalInboxRecent,
  useBuyerContractReviewApproval,
  usePurchaseDemandReview,
  usePurchaseOrderCreate,
  useRfqAwardReviewApproval,
} from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// S1c/S5a：审批中心。需求审批 + 定标审批(通过后自动生成采购订单)。
export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const pending = useApprovalInboxPending();
  const recent = useApprovalInboxRecent();
  const review = usePurchaseDemandReview();
  const awardReview = useRfqAwardReviewApproval();
  const orderCreate = usePurchaseOrderCreate();
  const contractReview = useBuyerContractReviewApproval();
  const [feedback, setFeedback] = useState<string | null>(null);

  const tasks = pending.data?.data ?? [];
  const recentTasks = recent.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(approvals|demands|rfqs|orders)/.test(q.queryKey[0] as string),
    });

  const busyBizId =
    (review.isPending && review.variables?.demandId) ||
    (awardReview.isPending && awardReview.variables?.data.awardId) ||
    (orderCreate.isPending && orderCreate.variables?.data.awardId) ||
    (contractReview.isPending && contractReview.variables?.contractId) ||
    null;

  const handleContractReview = (contractId: string, approved: boolean) => {
    contractReview.mutate(
      { contractId, data: { approved } },
      {
        onSuccess: () => {
          setFeedback(approved ? '合同审批通过，已生效' : '合同审批已驳回');
          refresh();
        },
      },
    );
  };

  const handleDemandReview = (demandId: string, approved: boolean) => {
    review.mutate({ demandId, data: { approved } }, { onSuccess: () => refresh() });
  };

  // 定标审批：rfq_award 任务 bizId=awardId、parentBizId=rfqId。通过后自动生成订单。
  const handleAwardReview = (rfqId: string, awardId: string, approved: boolean) => {
    awardReview.mutate(
      { rfqId, data: { awardId, approved } },
      {
        onSuccess: () => {
          if (approved) {
            const eta = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
            orderCreate.mutate(
              { data: { awardId, expectedReceiptDate: eta } },
              {
                onSuccess: (res) => {
                  setFeedback(`定标审批通过，已生成采购订单 ${res.data?.id ?? ''}`);
                  refresh();
                },
                onError: () => {
                  setFeedback('定标已通过，但订单生成失败(可能已生成)。');
                  refresh();
                },
              },
            );
          } else {
            refresh();
          }
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <Panel title="审批中心" icon={CheckSquare} subtitle="待办审批 · 通过 / 驳回">
        <ListToolbar
          title="待办审批"
          recordCount={tasks.length}
          filterLabel="全部待办"
          actionLabel="固定模板"
        />
        {feedback && (
          <div className="mb-4">
            <FeedbackNotice tone="success" message={feedback} />
          </div>
        )}
        {pending.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载待办审批…" />
        ) : tasks.length === 0 ? (
          <FeedbackNotice tone="info" message="暂无待办审批。提交需求审批后将出现在此。" />
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => {
              const isDemand = t.bizType === 'purchase_demand';
              const isAward = t.bizType === 'rfq_award';
              const isContract = t.bizType === 'contract_approval';
              const busy = busyBizId === t.bizId;
              const onApprove = () => {
                if (isDemand && t.bizId) handleDemandReview(t.bizId, true);
                else if (isAward && t.bizId && t.parentBizId)
                  handleAwardReview(t.parentBizId, t.bizId, true);
                else if (isContract && t.bizId) handleContractReview(t.bizId, true);
              };
              const onReject = () => {
                if (isDemand && t.bizId) handleDemandReview(t.bizId, false);
                else if (isAward && t.bizId && t.parentBizId)
                  handleAwardReview(t.parentBizId, t.bizId, false);
                else if (isContract && t.bizId) handleContractReview(t.bizId, false);
              };
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{t.summaryTitle}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {t.bizType} · 提交人 {t.submittedByName ?? '—'}
                      </p>
                    </div>
                    {t.businessStatus && <StatusPill label={t.businessStatus} />}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MiniFact label="业务类型" value={t.bizType ?? '—'} />
                    <MiniFact label="金额" value={currency(t.amount)} />
                    <MiniFact label="任务状态" value={t.status ?? '—'} />
                  </div>
                  {isDemand || isAward || isContract ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={onApprove}
                        disabled={busy}
                        className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-400"
                      >
                        {busy ? '处理中' : isAward ? '通过并生成订单' : '通过'}
                      </button>
                      <button
                        type="button"
                        onClick={onReject}
                        disabled={busy}
                        className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        驳回
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-slate-400">
                      该业务类型审批将在对应切片接入。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {recentTasks.length > 0 && (
        <Panel title="最近审批" icon={CheckSquare} subtitle="已处理记录">
          <div className="space-y-2">
            {recentTasks.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-900">{t.summaryTitle}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">{t.bizType}</p>
                </div>
                {t.businessStatus && <StatusPill label={t.businessStatus} />}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
