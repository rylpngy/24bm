import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import {
  useBuyerReceiptCreate,
  useBuyerSupplierList,
  usePurchaseOrderList,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  StatusPill,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// S5b：采购订单履约。订单列表 + 抬头信息(收货地址/联系人/付款方式) + 已发货收货验收。
export function OrdersPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = usePurchaseOrderList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const receipt = useBuyerReceiptCreate();
  const orders = query.data?.data ?? [];

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    (suppliersQuery.data?.data ?? []).forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliersQuery.data]);

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
    <Panel title="采购订单" icon={Truck} subtitle="订单履约 · 抬头信息 · 收货验收">
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
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-mono font-black text-slate-950">{o.id}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    供应商 {o.supplierId ? (supplierNames[o.supplierId] ?? o.supplierId) : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {o.status && <StatusPill label={o.status} />}
                  <span className="font-mono text-sm font-black text-slate-900">
                    {currency(o.amount)}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="关联询价" value={o.rfqId ?? '—'} />
                <MiniFact label="预计到货" value={o.expectedReceiptDate ?? '—'} />
                <MiniFact label="付款方式" value={o.paymentTerms ?? '—'} />
                <MiniFact
                  label="收货联系人"
                  value={o.contactName ? `${o.contactName}` : '—'}
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-black text-slate-400">收货地址</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                    {o.deliveryAddress || '未填写收货地址。'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-black text-slate-400">收货联系方式</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                    {o.contactName || o.contactPhone
                      ? `${o.contactName || '—'} · ${o.contactPhone || '—'}`
                      : '未填写联系方式。'}
                  </p>
                </div>
              </div>

              {o.status === '已发货' && o.id && (
                <button
                  type="button"
                  onClick={() => handleReceive(o.id!)}
                  disabled={receipt.isPending && receipt.variables?.orderId === o.id}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                >
                  {receipt.isPending && receipt.variables?.orderId === o.id ? '收货中' : '确认收货'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
