import { ArrowRight } from 'lucide-react';

export interface MallComparisonQuote {
  productId: string; skuId: string; productName: string; brand: string; supplierName: string;
  skuCode: string; spec: string; unit: string; unitPrice: number; total: number;
  leadTimeDays: number; stockQty?: number | null; sameSpecification: boolean;
}
const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function specification(value: string) {
  try { const data = JSON.parse(value); return Object.entries(data).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' / ') || '未补充参数'; }
  catch { return value || '未补充参数'; }
}
export function MallComparisonTable({ rows, onSelect, actionLabel = '查看规格' }: { rows: MallComparisonQuote[]; onSelect?: (row: MallComparisonQuote) => void; actionLabel?: string }) {
  return <div className="min-w-0 overflow-x-auto rounded-md border border-slate-200">
    <table className="w-full min-w-[780px] table-fixed text-left text-xs">
      <thead className="bg-slate-50 text-slate-500"><tr>
        <th className="w-48 px-3 py-3">商品 / 规格</th><th className="w-32 px-3 py-3">品牌 / 供应商</th><th className="w-28 px-3 py-3 text-right">适用单价</th><th className="w-28 px-3 py-3 text-right">当前数量合计</th><th className="w-32 px-3 py-3">交期 / 参数</th>{onSelect && <th className="w-28 px-3 py-3 text-right">操作</th>}
      </tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.skuId}>
        <td className="px-3 py-3"><p className="truncate font-bold text-slate-900" title={row.productName}>{row.productName}</p><p className="mt-1 truncate text-slate-500" title={row.skuCode}>{row.skuCode}</p><p className="mt-1 line-clamp-2 break-words text-slate-500" title={specification(row.spec)}>{specification(row.spec)}</p></td>
        <td className="px-3 py-3"><p className="truncate" title={row.brand}>{row.brand || '未标注品牌'}</p><p className="mt-1 break-words text-slate-500">{row.supplierName}</p></td>
        <td className="px-3 py-3 text-right font-bold tabular-nums">{money(row.unitPrice)}<p className="mt-1 font-normal text-slate-500">/{row.unit}</p></td>
        <td className="px-3 py-3 text-right font-bold tabular-nums">{money(row.total)}</td>
        <td className="px-3 py-3"><p>{row.leadTimeDays} 天</p><p className={`mt-1 ${row.sameSpecification ? 'text-emerald-700' : 'text-amber-700'}`}>{row.sameSpecification ? '参数一致' : '参数不同'}</p></td>
        {onSelect && <td className="px-3 py-3 text-right"><button type="button" onClick={() => onSelect(row)} className="inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 font-bold text-blue-700">{actionLabel}<ArrowRight size={13} /></button></td>}
      </tr>)}{rows.length === 0 && <tr><td colSpan={onSelect ? 6 : 5} className="p-5 text-center text-slate-500">暂无满足当前数量的同物料可采购报价</td></tr>}</tbody>
    </table>
  </div>;
}
