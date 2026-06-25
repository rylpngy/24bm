import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import {
  useBuyerFinanceActionApproveVarianceHandling,
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
  const approve = useBuyerFinanceActionApproveVarianceHandling();
  const [feedback, setFeedback] = useState<string | null>(null);

  const varianceMatches = (matches.data?.data ?? []).filter((m) => m.matchStatus === '金额差异');
  const handlingList = handlings.data?.data ?? [];
  const handlingByInvoice = new Map(handlingList.map((h) => [h.invoiceId, h]));
  // 行级差异处理:由被标记的发票行项发起(带 orderLineId),抬头可能并无金额差异。
  const lineHandlings = handlingList.filter((h) => h.orderLineId);

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
      {
        onSuccess: () => {
          setFeedback('差异核实已提交。超 ¥10,000 的差异将转财务经理签核,否则直接结案解除阻断。');
          refresh();
        },
      },
    );

  const onApprove = (id: string, approved: boolean) =>
    approve.mutate(
      {
        varianceHandlingId: id,
        data: { approved, comment: approved ? '财务经理签核通过,差异结案' : '财务经理驳回,退回重新核实' },
      },
      {
        onSuccess: () => {
          setFeedback(approved ? '财务经理签核通过,付款阻断解除。' : '财务经理已驳回,退回待处理。');
          refresh();
        },
      },
    );

  // 渲染某条差异处理的操作区:按状态显示 标记已处理 / 财务经理签核(通过·驳回) / 已完成。
  const renderActions = (h?: { id?: string; status?: string }) => {
    if (!h?.id) return null;
    if (h.status === '已处理') {
      return <span className="text-xs font-bold text-emerald-700">差异已处理,付款可继续。</span>;
    }
    if (h.status === '待财务经理签核') {
      const busy = approve.isPending && approve.variables?.varianceHandlingId === h.id;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="待财务经理签核" />
          <button type="button" onClick={() => onApprove(h.id!, true)} disabled={busy}
            className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-400">
            {busy ? '签核中' : '财务经理签核通过'}
          </button>
          <button type="button" onClick={() => onApprove(h.id!, false)} disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50">
            驳回
          </button>
        </div>
      );
    }
    const busyR = resolve.isPending && resolve.variables?.varianceHandlingId === h.id;
    return (
      <button type="button" onClick={() => onResolve(h.id!)} disabled={busyR}
        className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-400">
        {busyR ? '处理中' : '标记已处理(超 ¥1万转签核)'}
      </button>
    );
  };

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
            return (
              <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono font-black text-slate-950">{m.invoiceId}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">订单 {m.orderId}</p>
                  </div>
                  <StatusPill label={handled ? '已处理' : h?.status ?? '待处理'} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniFact label="订单金额" value={currency(m.orderAmount)} />
                  <MiniFact label="发票金额" value={currency(m.invoiceAmount)} />
                  <MiniFact label="差异金额" value={currency(m.varianceAmount)} />
                  <MiniFact label="阻断原因" value={m.blockingReason ?? '—'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!h && m.id ? (
                    <PrimaryActionButton onClick={() => onCreate(m.id!)} busy={busyC} pendingLabel="登记中" flushTop>
                      登记差异处理
                    </PrimaryActionButton>
                  ) : (
                    renderActions(h)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lineHandlings.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-black text-slate-500">行级差异处理（源自被标记的发票行项）</p>
          <div className="mt-2 space-y-3">
            {lineHandlings.map((h) => {
              const handled = h.status === '已处理';
              return (
                <div key={h.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{h.lineDescription}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                        {h.invoiceId} · 订单 {h.orderId}
                      </p>
                    </div>
                    <StatusPill label={handled ? '已处理' : h.status ?? '待处理'} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MiniFact label="触发行" value={h.lineDescription ?? '—'} />
                    <MiniFact label="差异结论" value={h.reason ?? '—'} />
                    <MiniFact label="行差异金额" value={currency(h.varianceAmount)} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">{renderActions(h)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
