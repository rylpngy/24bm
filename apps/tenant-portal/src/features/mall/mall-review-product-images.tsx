import { RefreshCw } from 'lucide-react';
import { useMallProductImages } from '@24bid/api-client/mall-product-media';
import { ProductImageGallery } from '@24bid/ui/components/product-image';

export function MallReviewProductImages({ productId, name }: { productId?: string; name?: string }) {
  const { images, query, imageError } = useMallProductImages(productId, 'buyer-review');
  if (query.isError || imageError) return <div className="my-3 flex items-center gap-2 text-xs text-red-700">
    <p role="status">审核图片加载失败或无权查看</p>
    <button type="button" aria-label="刷新审核图片" title="刷新审核图片" disabled={query.isFetching}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200"
      onClick={() => void query.refetch()}><RefreshCw size={14} /></button>
  </div>;
  if (query.isPending) return <p role="status" className="my-3 text-xs text-slate-500">加载审核图片中</p>;
  if (query.data?.length === 0) return <p className="my-3 text-xs text-slate-500">暂无商品图片</p>;
  return <div className="my-3 max-w-xl"><ProductImageGallery images={images} alt={name ?? '待审核商品图片'} /></div>;
}
