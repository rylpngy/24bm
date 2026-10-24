import type { MallProductResponse } from '@24bid/api-client';
import { cn } from '@24bid/ui';
import { BuyerProductImages } from './buyer-product-images';

export const currency = (v?: number | null) =>
  v == null ? '待询价' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

/** 商品卡:列表与首页共用。仅展示真实字段,无占位图与假标签。 */
export function ProductCard({
  product,
  onOpen,
}: {
  product: MallProductResponse;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 text-left',
        'shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md',
      )}
    >
      {product.mainImageKey ? <BuyerProductImages productId={product.id} name={product.name} compact /> :
        <p className="mb-2 text-xs text-slate-400">暂无商品图片</p>}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-black text-slate-950 group-hover:text-blue-700">
          {product.name}
        </p>
        {product.scope === 'public' && (
          <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
            公开专区
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs font-bold text-slate-500">
        {product.brand || '—'} · {product.supplierName}
      </p>
      <p className="mt-1 truncate text-[11px] font-bold text-slate-400">
        {product.categoryName || '未分类'}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-mono text-lg font-black text-blue-700">
          {currency(product.fromPrice)}
        </span>
        <span className="text-[11px] font-bold text-slate-400">
          {(product.skuCount ?? 0) > 1 ? `${product.skuCount} 个规格` : '单规格'}
        </span>
      </div>
    </button>
  );
}
