import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { useBuyerReceiptCreate, usePurchaseOrderList } from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  ResponsiveTableFrame,
  StatusPill,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// S5b：采购订单履约。订单列表 + 已发货订单收货验收。
export function OrdersPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = usePurchaseOrderList();
  const receipt = useBuyerReceiptCreate();
  const orders = query.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(orders|receipts)/.test(q.queryKey[0] as string),
    });

  const handleReceive = (orderId: string) => {
    receipt.mutate(
      { orderId, data: { result: '验收合格' } },
      {
        onSuccess: () => {
          setFeedback(`订单 ${orderId} 收货验收完成`);
          refresh();
        },
      },
    );
  };

  return (
    <Panel title="采购订单" icon={Truck} subtitle="订单履约 · 收货验收">
      <ListToolbar
        title="采购订单"
        recordCount={orders.length}
        filterLabel="全部"
        actionLabel="由定标生成"
      />
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载采购订单…" />
      ) : orders.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无采购订单。定标审批通过后由系统生成。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={orders.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{o.id}</p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-500">{currency(o.amount)}</p>
                </div>
                {o.status && <StatusPill label={o.status} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="询价" value={o.rfqId ?? '—'} />
                <MiniFact label="预计到货" value={o.expectedReceiptDate ?? '—'} />
              </div>
              {o.status === '已发货' && o.id && (
                <button
                  type="button"
                  onClick={() => handleReceive(o.id!)}
                  disabled={receipt.isPending && receipt.variables?.orderId === o.id}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                >
                  {receipt.isPending && receipt.variables?.orderId === o.id ? '收货中' : '确认收货'}
                </button>
              )}
            </div>
          ))}
        >
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">订单号</th>
                <th className="px-4 py-3">询价</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">预计到货</th>
                <th className="px-4 py-3 text-right">金额</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-4 font-mono font-black text-slate-700">{o.id}</td>
                  <td className="px-4 py-4 text-slate-600">{o.rfqId}</td>
                  <td className="px-4 py-4">{o.status && <StatusPill label={o.status} />}</td>
                  <td className="px-4 py-4 text-slate-600">{o.expectedReceiptDate}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {currency(o.amount)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {o.status === '已发货' && o.id ? (
                      <button
                        type="button"
                        onClick={() => handleReceive(o.id!)}
                        disabled={receipt.isPending && receipt.variables?.orderId === o.id}
                        className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                      >
                        {receipt.isPending && receipt.variables?.orderId === o.id ? '收货中' : '确认收货'}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      )}
    </Panel>
  );
}
