import { Receipt } from 'lucide-react';
import { useSupplierReceivableList } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, StatusPill } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 发票应收:供应商发票与回款状态。
export function ReceivablesPage() {
  const recv = useSupplierReceivableList();
  const list = recv.data?.data ?? [];

  return (
    <Panel title="发票应收" icon={Receipt} subtitle="发票 · 回款状态">
      <div className="mb-4">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">
          共 {list.length} 条
        </span>
      </div>
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
              {(inv.lineItems ?? []).length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    发票行项明细（{(inv.lineItems ?? []).length} 项）
                  </p>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="px-3 py-1.5">品名/规格</th>
                        <th className="px-3 py-1.5 text-right">数量</th>
                        <th className="px-3 py-1.5 text-right">单价</th>
                        <th className="px-3 py-1.5 text-right">行金额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(inv.lineItems ?? []).map((l) => (
                        <tr key={l.id} className="font-bold text-slate-700">
                          <td className="px-3 py-1.5">{l.description}</td>
                          <td className="px-3 py-1.5 text-right">
                            {l.quantity}
                            {l.unit ? ` ${l.unit}` : ''}
                          </td>
                          <td className="px-3 py-1.5 text-right">{currency(l.unitPrice)}</td>
                          <td className="px-3 py-1.5 text-right font-black text-slate-900">{currency(l.lineAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
