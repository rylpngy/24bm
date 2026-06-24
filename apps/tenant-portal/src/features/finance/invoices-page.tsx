import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { useBuyerPaymentList, useBuyerPaymentUpdate } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// S6：发票付款 + 三单匹配。发票列表 + 付款登记(待付款→部分付款→已付款)。
export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = useBuyerPaymentList();
  const pay = useBuyerPaymentUpdate();
  const invoices = query.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/invoices'),
    });

  const register = (invoiceId: string, paymentStatus: string) => {
    pay.mutate(
      { invoiceId, data: { paymentStatus } },
      {
        onSuccess: () => {
          setFeedback(`发票 ${invoiceId} 已登记为「${paymentStatus}」`);
          refresh();
        },
        onError: () => setFeedback('付款登记失败：可能存在三单差异或金额不一致。'),
      },
    );
  };

  return (
    <Panel title="发票付款" icon={Receipt} subtitle="发票 · 三单匹配 · 付款登记">
      <ListToolbar
        title="发票"
        recordCount={invoices.length}
        filterLabel="全部"
        actionLabel="供应商开票"
      />
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载发票…" />
      ) : invoices.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无发票。供应商对已收货订单开票后出现。" />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const variance = inv.varianceAmount ?? 0;
            const matched = variance === 0;
            const busy = pay.isPending && pay.variables?.invoiceId === inv.id;
            return (
              <div
                key={inv.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">{inv.invoiceNo ?? inv.id}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">订单 {inv.orderId}</p>
                  </div>
                  {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                </div>

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">三单匹配</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <MiniFact label="发票金额" value={currency(inv.amount)} />
                    <MiniFact label="订单金额" value={currency(inv.orderAmount)} />
                    <MiniFact label="收货状态" value={inv.receiptStatus ?? '—'} />
                    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
                      <span className="text-[11px] font-black text-slate-400">匹配</span>
                      <StatusPill label={matched ? '已匹配' : `差异 ${currency(variance)}`} />
                    </div>
                  </div>
                </div>

                {(inv.paymentStatus === '待付款' || inv.paymentStatus === '部分付款') && inv.id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inv.paymentStatus === '待付款' && (
                      <button
                        type="button"
                        onClick={() => register(inv.id!, '部分付款')}
                        disabled={busy}
                        className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-white px-4 text-xs font-black text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                      >
                        登记部分付款
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => register(inv.id!, '已付款')}
                      disabled={busy}
                      className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-400"
                    >
                      {busy ? '登记中' : '登记已付款'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
