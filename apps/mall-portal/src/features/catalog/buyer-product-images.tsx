import { useMallProductImages } from '@24bid/api-client/mall-product-media';
import { ProductImage, ProductImageGallery } from '@24bid/ui/components/product-image';
import { RefreshCw } from 'lucide-react';

export function BuyerProductImages({ productId, name, compact = false }: { productId?: string; name?: string; compact?: boolean }) {
  const { images, query, imageError } = useMallProductImages(productId, 'buyer', compact);
  if (query.isError || imageError) return compact ? null : <div className="flex items-center gap-2 text-sm text-slate-500">
    <p role="status">商品图片暂不可用</p><button type="button" aria-label="重新加载商品图片" title="重新加载商品图片"
      disabled={query.isFetching} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 disabled:opacity-50"
      onClick={() => void query.refetch()}><RefreshCw size={14} /></button>
  </div>;
  if (!images.length) return query.data?.length === 0 ? <p className="text-xs text-slate-500">暂无商品图片</p> : null;
  return compact ? <ProductImage src={images[0].src} alt={name ?? '商品图片'} className="mb-3" /> :
    <ProductImageGallery images={images} alt={name ?? '商品图片'} />;
}
