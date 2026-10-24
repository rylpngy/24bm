import { useState } from 'react';
import { cn } from '../lib/cn';

export interface ProductImageProps { src?: string | null; alt: string; className?: string }

/** Blob URLs are resolved by the authenticated application layer; absent images have no substitute. */
export function ProductImage({ src, alt, className }: ProductImageProps) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!src?.startsWith('blob:')) return null;
  return <div className={cn('w-full overflow-hidden bg-white', className)} style={{ aspectRatio: '4 / 3' }}>
    {broken === src ? <p role="status" className="p-2 text-xs text-slate-500">商品图片加载失败</p> :
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
        className="h-full w-full object-contain" onError={() => setBroken(src)} />}
  </div>;
}

export interface ProductGalleryImage { id: string; src: string; main?: boolean }
export function ProductImageGallery({ images, alt }: { images: ProductGalleryImage[]; alt: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const valid = images.filter(image => image.src.startsWith('blob:'));
  const image = valid.find(item => item.id === selected) ?? valid.find(item => item.main) ?? valid[0];
  if (!image) return null;
  return <div className="min-w-0 space-y-2">
    <ProductImage src={image.src} alt={alt} className="max-h-80" />
    {valid.length > 1 && <div className="flex flex-wrap gap-2" aria-label="商品图集">
      {valid.map((item, index) => <button key={item.id} type="button" aria-label={`查看第${index + 1}张商品图片`}
        title={`查看第${index + 1}张商品图片`} aria-pressed={item.id === image.id} onClick={() => setSelected(item.id)}
        className={cn('w-16 shrink-0 overflow-hidden rounded border p-1', item.id === image.id ? 'border-emerald-600' : 'border-slate-200')}>
        <ProductImage src={item.src} alt={`${alt} 图片${index + 1}`} />
      </button>)}
    </div>}
  </div>;
}
