import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance, type MallProductResponse } from '@24bid/api-client';
import { FeedbackNotice, Panel, RichTextView, StatusPill } from '@24bid/ui';
import { ArrowLeft, Check, Package, RefreshCw, X } from 'lucide-react';
import { productMediaPath, useMallProductImages } from '@24bid/api-client/mall-product-media';
import { ProductImageGallery } from '@24bid/ui/components/product-image';

const root = '/api/v1/platform/mall/products';
const queueKey = [`${root}/pending-review`];
const field = 'w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm';
const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-700 disabled:opacity-50';
const money = (value?: number) => value == null ? '—' : `¥${value.toFixed(2)}`;

export function PublicCatalogReviewsPage({ canManage = false }: { canManage?: boolean }) {
  const client = useQueryClient();
  const queue = useQuery({ queryKey: queueKey, enabled: canManage,
    queryFn: async ({ signal }) => (await axiosInstance.get<{ data: MallProductResponse[] }>(queueKey[0], { signal })).data.data });
  const [selectedId, setSelectedId] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState('');
  const [validation, setValidation] = useState('');
  const lock = useRef(false);
  const selected = queue.data?.find(p => p.id === selectedId);
  const mutation = useMutation({ mutationFn: async ({ product, approved }: { product: MallProductResponse; approved: boolean }) => {
    const result = await axiosInstance.post<{ data: MallProductResponse }>(`${root}/${encodeURIComponent(product.id!)}/review`, { approved, comment: comment.trim() });
    return { product, result: result.data.data };
  }, onSuccess: async ({ product, result }) => {
    client.setQueryData<MallProductResponse[]>(queueKey, rows => rows?.filter(p => p.id !== product.id));
    setSelectedId(undefined); setComment('');
    setFeedback(`「${product.name}」${result.status === '在架' ? '已审核通过并上架。' : '已退回草稿。'}`);
    await client.invalidateQueries({ queryKey: queueKey });
  }, onSettled: () => { lock.current = false; } });
  function review(approved: boolean) {
    setValidation(''); setFeedback('');
    if (!canManage || !selected || queue.isError || queue.isFetching || mutation.isPending || lock.current) return;
    if (!comment.trim()) { setValidation('请填写审核意见。'); return; }
    lock.current = true;
    mutation.mutate({ product: selected, approved });
  }
  const error = (mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '审核失败，意见已保留，请刷新后重试。';
  const rows = (queue.data ?? []).filter(p => [p.name, p.brand, p.supplierName, p.id].join(' ').toLowerCase().includes(keyword.toLowerCase()));
  if (!canManage) return <FeedbackNotice tone="error" message="当前账号无权审核公开商品。" />;
  return <Panel title="公开商品审核" icon={Package} subtitle="">
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input aria-label="搜索待审商品" className={`${field} max-w-sm`} value={keyword} disabled={mutation.isPending} onChange={e => setKeyword(e.target.value)} placeholder="商品名称 / 供应商 / 编号" />
      <span className="mr-auto text-sm text-slate-500">待审核 {queue.data?.length ?? 0} 件</span>
      <button type="button" className={button} disabled={mutation.isPending || queue.isFetching} title="刷新待审商品" aria-label="刷新待审商品" onClick={() => void queue.refetch()}><RefreshCw size={15} /></button>
    </div>
    {feedback && <div className="mb-3" role="status"><FeedbackNotice tone="success" message={feedback} /></div>}
    {queue.isError ? <div role="alert"><FeedbackNotice tone="error" message="待审商品加载失败，请刷新重试。" /></div>
      : queue.isPending ? <FeedbackNotice tone="info" message="正在加载待审商品…" />
      : selected ? <section aria-label="公开商品审核详情" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={button} title="返回待审清单" aria-label="返回待审清单" disabled={mutation.isPending} onClick={() => { setSelectedId(undefined); setComment(''); setValidation(''); mutation.reset(); }}><ArrowLeft size={15} /></button>
          <h2 className="min-w-0 flex-1 break-words text-base font-bold">{selected.name}</h2><StatusPill label={selected.status ?? ''} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">供应商</dt><dd className="mt-1 break-words font-semibold">{selected.supplierName ?? selected.supplierId}</dd></div>
          <div><dt className="text-slate-500">品牌 / 分类</dt><dd className="mt-1 break-words">{selected.brand || '无品牌'} / {selected.categoryName || '未分类'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">商品编号</dt><dd className="mt-1 break-all font-mono text-xs">{selected.id}</dd></div>
        </dl>
        {selected.descriptionHtml && <RichTextView html={selected.descriptionHtml} />}
        <PublicProductReviewImages key={selected.id} productId={selected.id!} name={selected.name ?? '商品'} />
        <section aria-label="待审规格" className="divide-y divide-slate-100 border-y border-slate-200">
          {(selected.skus ?? []).map(sku => <div key={sku.id} className="space-y-2 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="min-w-0 flex-1 break-words">{sku.skuCode || '未编码规格'} · {money(sku.price)} / {sku.unit}</strong><StatusPill label={sku.status ?? ''} /></div>
            <p className="break-all font-mono text-xs text-slate-500">{sku.spec}</p>
            <p className="text-slate-600">起订 {sku.minOrderQty} · 步长 {sku.stepQty} · 库存 {sku.stockQty ?? '不限量'} · 交期 {sku.leadTimeDays} 天</p>
            {(sku.tierPrices ?? []).length > 0 && <p className="break-words text-slate-600">阶梯价：{sku.tierPrices?.map(t => `${t.minQty} 起 ${money(t.price)}`).join('；')}</p>}
          </div>)}
        </section>
        <label className="block text-sm font-bold">审核意见<textarea className={`${field} mt-2 min-h-24 font-normal`} maxLength={2000} value={comment} disabled={mutation.isPending} onChange={e => setComment(e.target.value)} /></label>
        {(validation || mutation.isError) && <div role="alert"><FeedbackNotice tone="error" message={validation || error} /></div>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={button} disabled={mutation.isPending || queue.isFetching || !comment.trim()} onClick={() => review(false)}><X size={15} />驳回</button>
          <button type="button" className={`${button} border-blue-600 bg-blue-600 text-white`} disabled={mutation.isPending || queue.isFetching || !comment.trim()} onClick={() => review(true)}><Check size={15} />{mutation.isPending ? '提交中…' : '审核通过'}</button>
        </div>
      </section>
        : rows.length === 0 ? <p className="py-6 text-sm text-slate-500">{keyword ? '没有符合条件的待审商品' : '暂无待审公开商品'}</p>
          : <div className="divide-y divide-slate-100">{rows.map(product => <div key={product.id} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1 break-words"><h2 className="text-sm font-bold">{product.name}</h2><p className="mt-1 text-xs text-slate-500">{product.supplierName} · {product.skuCount ?? 0} 个规格 · {product.updatedAt?.slice(0, 10) ?? '—'}</p><p className="mt-1 break-all font-mono text-xs text-slate-400">{product.id}</p></div>
            <StatusPill label={product.status ?? ''} /><button type="button" className={button} disabled={mutation.isPending} onClick={() => { setSelectedId(product.id); setFeedback(''); setComment(''); setValidation(''); mutation.reset(); }}>审核商品</button>
          </div>)}</div>}
  </Panel>;
}

function PublicProductReviewImages({ productId, name }: { productId: string; name: string }) {
  const client = useQueryClient();
  const { images, query, imageError } = useMallProductImages(productId, 'platform');
  return <section aria-label="待审商品图片" className="max-w-2xl space-y-3">
    <h3 className="text-sm font-bold">商品图片</h3>
    {query.isError || imageError ? <FeedbackNotice tone="error" message="商品图片加载失败，请刷新后重试。" />
      : query.isPending ? <p role="status" className="text-sm text-slate-500">正在加载商品图片…</p>
        : query.data?.length === 0 ? <p className="text-sm text-slate-500">暂无商品图片</p>
          : <ProductImageGallery images={images} alt={name} />}
    <button type="button" className={button} title="刷新商品图片" aria-label="刷新商品图片" disabled={query.isFetching}
      onClick={() => void client.resetQueries({ queryKey: [productMediaPath('platform', productId)] })}><RefreshCw size={15} /></button>
  </section>;
}
