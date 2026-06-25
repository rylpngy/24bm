import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import {
  useBuyerFinanceActionCreateVarianceHandlingFromThreeWayMatch,
  useBuyerFinanceActionThreeWayMatches,
  useBuyerFinanceActionUpdateVarianceHandlingStatus,
  useBuyerFinanceActionVarianceHandlings,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 对账差异处理:三单匹配金额差异 → 登记差异处理 → 标记已处理(解除付款阻断)。
export function ReconciliationVariancePanel() {
  const queryClient = useQueryClient();
  const matches = useBuyerFinanceActionThreeWayMatches();
  const handlings = useBuyerFinanceActionVarianceHandlings();
  const createHandling = useBuyerFinanceActionCreateVarianceHandlingFromThreeWayMatch();
  const resolve = useBuyerFinanceActionUpdateVarianceHandlingStatus();
  const [feedback, setFeedback] = useState<string | null>(null);

  const varianceMatches = (matches.data?.data ?? []).filter((m) => m.matchStatus === '金额差异');
  const handlingList = handlings.data?.data ?? [];
  const handlingByInvoice = new Map(handlingList.map((h) => [h.invoiceId, h]));

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /three-way-matches|variance-handlings|\/buyer\/invoices/.test(q.queryKey[0] as string),
    });

  const onCreate = (matchId: string) =>
    createHandling.mutate(
      { matchId },
      { onSuccess: () => { setFeedback('差异处理已登记,完成核实后标记已处理。'); refresh(); } },
    );

  const onResolve = (id: string) =>
    resolve.mutate(
      { varianceHandlingId: id, data: { status: '已处理', result: '已与供应商核实,按差异金额调整入账' } },
      { onSuccess: () => { setFeedback('差异已处理,付款阻断解除。'); refresh(); } },
    );

  if (varianceMatches.length === 0 && handlingList.length === 0) return null;

  return (
    <Panel title="对账差异处理" icon={Scale} subtitle="三单金额差异 · 登记 · 核实闭环">
      {feedback && (
        <div className="mb-3">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {varianceMatches.length === 0 ? (
        <FeedbackNotice tone="info" message="当前无未处理的金额差异。" />
      ) : (
        <div className="space-y-3">
          {varianceMatches.map((m) => {
            const h = handlingByInvoice.get(m.invoiceId);
            const handled = h?.status === '已处理';
            const busyC = createHandling.isPending && createHandling.variables?.matchId === m.id;
            const busyR = resolve.isPending && resolve.variables?.varianceHandlingId === h?.id;
            return (
              <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">{m.invoiceId}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">订单 {m.orderId}</p>
                  </div>
                  <StatusPill label={handled ? '已处理' : h ? '处理中' : '待处理'} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniFact label="订单金额" value={currency(m.orderAmount)} />
                  <MiniFact label="发票金额" value={currency(m.invoiceAmount)} />
                  <MiniFact label="差异金额" value={currency(m.varianceAmount)} />
                  <MiniFact label="阻断原因" value={m.blockingReason ?? '—'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!h && m.id && (
                    <PrimaryActionButton onClick={() => onCreate(m.id!)} busy={busyC} pendingLabel="登记中" flushTop>
                      登记差异处理
                    </PrimaryActionButton>
                  )}
                  {h && !handled && h.id && (
                    <button type="button" onClick={() => onResolve(h.id!)} disabled={busyR}
                      className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-400">
                      {busyR ? '处理中' : '标记已处理(解除阻断)'}
                    </button>
                  )}
                  {handled && (
                    <span className="text-xs font-bold text-emerald-700">差异已处理,付款可继续。</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
