import { Receipt } from 'lucide-react';
import { useSupplierReceivableList } from '@24bid/api-client';
import { FeedbackNotice, ListToolbar, MiniFact, Panel, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 发票应收:供应商发票与回款状态。
export function ReceivablesPage() {
  const recv = useSupplierReceivableList();
  const list = recv.data?.data ?? [];

  return (
    <Panel title="发票应收" icon={Receipt} subtitle="发票 · 回款状态">
      <ListToolbar title="发票应收" recordCount={list.length} filterLabel="全部" actionLabel="我的应收" />
      {recv.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载发票应收…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无发票。对已收货订单开票后出现在此。" />
      ) : (
        <div className="space-y-3">
          {list.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{inv.invoiceNo ?? inv.id}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">订单 {inv.orderId}</p>
                </div>
                {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniFact label="发票金额" value={currency(inv.amount)} />
                <MiniFact label="对账阶段" value={inv.reconciliationStage ?? '—'} />
                <MiniFact label="到期日" value={inv.dueDate ?? '—'} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
