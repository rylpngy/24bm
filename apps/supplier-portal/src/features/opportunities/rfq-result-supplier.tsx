import { Award } from 'lucide-react';
import { useSupplierQuoteResult } from '@24bid/api-client';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 供应商:已定标 RFQ 的结果——本方是否中标 + 中标人/金额。
export function RfqResultSupplier({ rfqId, supplierId }: { rfqId: string; supplierId: string }) {
  const result = useSupplierQuoteResult(rfqId);
  const d = result.data?.data;
  if (!d) return null;
  const won = d.winnerSupplierId === supplierId;

  return (
    <div
      className={
        won
          ? 'mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3'
          : 'mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3'
      }
    >
      <p className={`flex items-center gap-1.5 text-sm font-black ${won ? 'text-emerald-700' : 'text-slate-600'}`}>
        <Award size={15} /> {won ? '恭喜,本方中标' : '本次未中标'}
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-slate-400">
        中标供应商 {d.winnerSupplierId === supplierId ? '本企业' : (d.winnerSupplierId ?? '—')} · {currency(d.winnerAmount)}
      </p>
    </div>
  );
}
