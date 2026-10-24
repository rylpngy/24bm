import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import { ProductImageGallery } from '@24bid/ui/components/product-image';
import { ConfirmDialog, FeedbackNotice } from '@24bid/ui';
import { deleteMallProductImage, setMallProductMainImage, uploadMallProductImage,
  useMallProductImages } from '@24bid/api-client/mall-product-media';

export function SupplierProductGallery({ productId, productName = '商品图片', canManage = false, disabled = false, onBusyChange, onChanged }: {
  productId: string; productName?: string; canManage?: boolean; disabled?: boolean;
  onBusyChange?: (busy: boolean) => void; onChanged?: () => void;
}) {
  const { images, query, imageError } = useMallProductImages(productId, 'supplier');
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const locked = busy || disabled;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => { onBusyChange?.(false); };
  }, [busy, onBusyChange]);
  const button = 'inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 px-3 text-sm disabled:opacity-50';
  async function change(action: () => Promise<unknown>) {
    if (!canManage || locked) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await action();
      await client.invalidateQueries({ predicate: entry => typeof entry.queryKey[0] === 'string'
        && entry.queryKey[0].includes('/mall/products') });
      setNotice('图片已更新，商品须重新提交审核'); setDeleting(null); onChanged?.();
    } catch (cause) {
      setError((cause as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? (cause instanceof Error ? cause.message : '图片更新失败，请重试'));
    } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <section aria-label="商品图库" className="min-w-0 space-y-3 border-t border-slate-200 py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">商品图库</h3>
      <div className="flex gap-2">
        <button type="button" className={button} aria-label="刷新图片" title="刷新图片" disabled={locked} onClick={() => void query.refetch()}><RefreshCw size={15} /></button>
        {canManage && <button type="button" className={button} disabled={locked || query.isError || query.isPending || (query.data?.length ?? 0) >= 8}
          onClick={() => input.current?.click()}><Upload size={15} />{busy ? '上传处理中' : '上传图片'}</button>}
      </div>
    </div>
    {canManage && <input ref={input} type="file" accept="image/png,image/jpeg" aria-label="选择商品图片" className="sr-only"
      disabled={locked} onChange={event => { const file = event.target.files?.[0]; if (file) void change(() => uploadMallProductImage(productId, file)); }} />}
    {error && <FeedbackNotice tone="error" message={error} />}{notice && <FeedbackNotice tone="success" message={notice} />}
    {query.isError || imageError ? <FeedbackNotice tone="error" message="商品图片加载失败，请刷新重试" /> : query.isPending ? <p role="status">加载图片中</p> :
      (query.data?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">暂无商品图片</p> : <ProductImageGallery images={images} alt={productName} />}
    <ul className="divide-y divide-slate-100">
      {!query.isError && query.data?.map(item => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <span className="min-w-0 flex-1 break-all">{item.fileName}</span>
        {item.main ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} />主图</span> : canManage &&
          <button type="button" className={button} disabled={locked} onClick={() => void change(() => setMallProductMainImage(productId, item.id))}><Star size={14} />设为主图</button>}
        {canManage && <button type="button" className={button} aria-label={`删除图片 ${item.fileName}`} title="删除图片" disabled={locked} onClick={() => setDeleting(item.id)}><Trash2 size={14} /></button>}
      </li>)}
    </ul>
    <ConfirmDialog open={deleting !== null} title="删除商品图片" message="删除后商品须重新提交审核。" tone="danger" busy={locked}
      onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) void change(() => deleteMallProductImage(productId, deleting)); }} />
  </section>;
}
