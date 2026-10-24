import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance, type MallProductResponse, type MallSkuResponse, type SaveMallProductRequest, type SaveMallSkuRequest, useSupplierMallMaterials } from '@24bid/api-client';
import { FeedbackNotice, StatusPill } from '@24bid/ui';
import { ArrowLeft, Package, Pencil, Plus, RefreshCw } from 'lucide-react';
import { SupplierProductGallery } from './supplier-product-gallery';

const base = '/api/v1/supplier/mall/products';
const input = 'mt-1 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm';
const button = 'inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-bold text-blue-700 disabled:opacity-50';
const errorText = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败，填写内容已保留，请重试。';
type Envelope<T> = { data: T };
type CatalogProduct = MallProductResponse & { tenantId?: string | null };
type CatalogCategory = { id: string; name: string; tenantId?: string | null; parentId?: string | null };
const categoryUrl = '/api/v1/supplier/mall/categories';

export function ProductCenter({ canManage = false, onBusyChange }: { canManage?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const client = useQueryClient();
  const products = useQuery({ queryKey: [base], queryFn: async ({ signal }) => (await axiosInstance.get<Envelope<CatalogProduct[]>>(base, { signal })).data.data });
  const [selected, setSelected] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('全部');
  const refresh = async () => {
    await client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('/supplier/mall') });
  };
  const current = products.data?.find(p => p.id === selected);
  const rows = (products.data ?? []).filter(p => (status === '全部' || p.status === status)
    && [p.name, p.brand, p.categoryName, p.id].join(' ').toLowerCase().includes(keyword.toLowerCase()));
  return <section aria-label="商品与规格" className="mb-5 border-b border-slate-200 pb-5">
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="mr-auto flex items-center gap-2 text-base font-bold text-slate-950"><Package size={17} />商品与规格</h2>
      <button className={button} disabled={busy || products.isFetching} onClick={() => void refresh()} title="刷新商品"><RefreshCw size={15} /><span className="sr-only">刷新商品</span></button>
      {canManage && <button className={button} disabled={busy} onClick={() => { setCreating(true); setSelected(undefined); setFeedback(''); }}><Plus size={15} />新建商品</button>}
    </div>
    {feedback && <FeedbackNotice tone="success" message={feedback} />}
    {creating && canManage ? <ProductEditor key="new" busyChanged={setBusy} onBack={() => setCreating(false)} onSaved={async p => { await refresh(); setCreating(false); setSelected(p.id); setFeedback('草稿已保存。'); }} />
      : current ? <ProductDetail key={current.id} product={current} canManage={canManage} busyChanged={setBusy} onBack={() => setSelected(undefined)} refresh={refresh} onNotice={setFeedback} />
      : <>
        <div className="my-3 flex flex-wrap gap-2">
          <input aria-label="搜索商品与规格" className={`${input} max-w-sm`} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="商品名称 / 品牌 / 编号" />
          <select aria-label="商品审核状态" className={`${input} sm:w-36`} value={status} onChange={e => setStatus(e.target.value)}>{['全部', '草稿', '待审核', '在架', '下架'].map(s => <option key={s}>{s}</option>)}</select>
        </div>
        {products.isPending ? <FeedbackNotice tone="info" message="正在加载商品…" /> : products.isError ? <FeedbackNotice tone="error" message="商品加载失败，请刷新重试。" /> : rows.length === 0 ? <p className="py-4 text-sm text-slate-500">暂无符合条件的商品</p> : <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {rows.map(p => <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1 break-words"><p className="text-sm font-bold">{p.name}</p><p className="mt-1 text-xs text-slate-500">{p.brand || '无品牌'} · {p.categoryName || '未分类'} · {p.skuCount ?? 0} 个规格</p><p className="mt-1 break-all text-xs text-slate-400">{p.id}</p></div>
            <StatusPill label={p.status ?? ''} />
            <button className={button} onClick={() => { setSelected(p.id); setFeedback(''); }}><Pencil size={14} />{canManage ? '维护规格' : '查看规格'}</button>
          </div>)}
        </div>}
      </>}
  </section>;
}

function ProductEditor({ product, onBack, onSaved, busyChanged }: { product?: CatalogProduct; onBack: () => void; onSaved: (p: CatalogProduct) => Promise<void>; busyChanged: (busy: boolean) => void }) {
  const materials = useSupplierMallMaterials();
  const buyers = [...new Map((materials.data?.data ?? []).map(m => [m.tenantId, m.tenantName])).entries()];
  const [tenantId, setTenantId] = useState('');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const categoryTenant = product ? product.tenantId ?? '' : tenantId;
  const categoryEnabled = Boolean(product) || Boolean(categoryTenant);
  const categories = useQuery({ queryKey: [categoryUrl, categoryTenant], enabled: categoryEnabled,
    queryFn: async ({ signal }) => (await axiosInstance.get<Envelope<CatalogCategory[]>>(categoryUrl, {
      params: categoryTenant ? { tenantId: categoryTenant } : undefined, signal,
    })).data.data });
  const categoryUnavailable = categoryEnabled && (categories.isPending || categories.isError);
  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [description, setDescription] = useState(product?.descriptionHtml ?? '');
  const mutation = useMutation({ mutationFn: async () => {
    const body: SaveMallProductRequest = { tenantId: product ? undefined : tenantId, name: name.trim(), brand: brand.trim(), descriptionHtml: description, categoryId: categoryId || undefined, mainImageKey: product?.mainImageKey };
    const result = product?.id ? await axiosInstance.put<Envelope<CatalogProduct>>(`${base}/${encodeURIComponent(product.id)}`, body) : await axiosInstance.post<Envelope<CatalogProduct>>(base, body);
    await onSaved(result.data.data);
  }, onMutate: () => busyChanged(true), onSettled: () => busyChanged(false) });
  return <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); if (!mutation.isPending && !categoryUnavailable) mutation.mutate(); }}>
    {!product && <label className="block text-sm font-bold">目标采购方<select className={input} required value={tenantId} disabled={mutation.isPending} onChange={e => { setTenantId(e.target.value); setCategoryId(''); }}><option value="">选择采购方</option>{buyers.map(([id, title]) => <option key={id} value={id}>{title ?? id}</option>)}</select></label>}
    {materials.isError && !product && <FeedbackNotice tone="error" message="采购方目录加载失败，请稍后重试。" />}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-bold">商品名称<input className={input} required value={name} disabled={mutation.isPending} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm font-bold">品牌<input className={input} value={brand} disabled={mutation.isPending} onChange={e => setBrand(e.target.value)} /></label>
    </div>
    <label className="block text-sm font-bold">商品分类<select className={input} value={categoryId}
      disabled={mutation.isPending || !categoryEnabled || categoryUnavailable} onChange={e => setCategoryId(e.target.value)}>
      <option value="">未分类</option>
      {product?.categoryId && !(categories.data ?? []).some(c => c.id === product.categoryId)
        && <option value={product.categoryId}>{product.categoryName || '原有分类'}</option>}
      {(categories.data ?? []).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select></label>
    {categories.isFetching && <p role="status" className="text-xs text-slate-500">正在加载商品分类…</p>}
    {categories.isError && <div role="alert"><FeedbackNotice tone="error" message="商品分类加载失败，请重试。" />
      <button type="button" className={button} disabled={mutation.isPending || categories.isFetching} onClick={() => void categories.refetch()}>重试分类</button></div>}
    <label className="block text-sm font-bold">商品描述<textarea className={`${input} min-h-24`} value={description} disabled={mutation.isPending} onChange={e => setDescription(e.target.value)} /></label>
    {mutation.isError && <div role="alert"><FeedbackNotice tone="error" message={errorText(mutation.error)} /></div>}
    <div className="flex justify-end gap-2"><button type="button" className={button} disabled={mutation.isPending} onClick={onBack}>取消</button><button type="submit" className={button} disabled={mutation.isPending || categoryUnavailable || !name.trim() || (!product && !tenantId)}>{mutation.isPending ? '保存中…' : '保存草稿'}</button></div>
  </form>;
}

function ProductDetail({ product, canManage, onBack, refresh, onNotice, busyChanged }: { product: CatalogProduct; canManage: boolean; onBack: () => void; refresh: () => Promise<void>; onNotice: (notice: string) => void; busyChanged: (busy: boolean) => void }) {
  const [editingProduct, setEditingProduct] = useState(false);
  const [editingSku, setEditingSku] = useState<MallSkuResponse | null>();
  const [editorBusy, setEditorBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const mutation = useMutation({ mutationFn: async (action: { sku?: MallSkuResponse; status: string }) => {
    const url = `${base}/${encodeURIComponent(product.id!)}` + (action.sku ? `/skus/${encodeURIComponent(action.sku.id!)}` : '') + '/status';
    await axiosInstance.put(url, { status: action.status });
    await refresh();
    onNotice(action.status === '待审核' ? product.scope === 'public' ? '已提交平台审核。' : '已提交采购方审核。'
      : action.status === '在架' ? '规格已启用，商品需重新提交审核。' : '已下架。');
  } });
  const busy = mutation.isPending || editorBusy || galleryBusy;
  useEffect(() => { busyChanged(busy); }, [busy, busyChanged]);
  return <div className="mt-3 space-y-3">
    <div className="flex flex-wrap items-center gap-2"><button className={button} onClick={onBack} disabled={busy} title="返回商品中心"><ArrowLeft size={15} /><span className="sr-only">返回商品中心</span></button><h3 className="min-w-0 flex-1 break-words text-sm font-bold">{product.name}</h3><StatusPill label={product.status ?? ''} /></div>
    {editingProduct && canManage ? <ProductEditor product={product} busyChanged={setEditorBusy} onBack={() => setEditingProduct(false)} onSaved={async () => { await refresh(); setEditingProduct(false); onNotice('商品已保存为草稿，需重新提交审核。'); }} />
      : editingSku !== undefined && canManage ? <SkuEditor key={editingSku?.id ?? 'new'} product={product} sku={editingSku ?? undefined} busyChanged={setEditorBusy} onBack={() => setEditingSku(undefined)} onSaved={async () => { await refresh(); setEditingSku(undefined); onNotice('规格已保存，商品需重新提交审核。'); }} />
      : <>
        {canManage && <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy} onClick={() => setEditingProduct(true)}><Pencil size={14} />编辑商品</button>
          <button className={button} disabled={busy} onClick={() => setEditingSku(null)}><Plus size={14} />新增规格</button>
          {(product.status === '草稿' || product.status === '下架') && <button className={button} disabled={busy || !(product.skus ?? []).some(s => s.status === '在架')} onClick={() => mutation.mutate({ status: '待审核' })}>提交审核</button>}
          {(product.status === '在架' || product.status === '待审核') && <button className={button} disabled={busy} onClick={() => mutation.mutate({ status: '下架' })}>下架商品</button>}
        </div>}
        <SupplierProductGallery productId={product.id!} productName={product.name}
          canManage={canManage} disabled={mutation.isPending || editorBusy}
          onBusyChange={setGalleryBusy} onChanged={() => { void refresh(); }} />
        <div className="divide-y divide-slate-100">{(product.skus ?? []).map(s => <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1 break-words"><p className="text-sm font-bold">{s.skuCode || '未编码规格'} · {s.price?.toFixed(2)} 元 / {s.unit}</p><p className="mt-1 break-all text-xs text-slate-500">{s.spec}</p><p className="mt-1 text-xs text-slate-500">起订 {s.minOrderQty} · 步长 {s.stepQty} · 库存 {s.stockQty ?? '不限量'} · 交期 {s.leadTimeDays} 天</p></div>
          <StatusPill label={s.status ?? ''} />{canManage && <><button className={button} disabled={busy} onClick={() => setEditingSku(s)}>编辑规格</button><button className={button} disabled={busy} onClick={() => mutation.mutate({ sku: s, status: s.status === '在架' ? '下架' : '在架' })}>{s.status === '在架' ? '停用规格' : '启用规格'}</button></>}
        </div>)}</div>
        {mutation.isError && <div role="alert"><FeedbackNotice tone="error" message={errorText(mutation.error)} /></div>}
      </>}
  </div>;
}

function SkuEditor({ product, sku, onBack, onSaved, busyChanged }: { product: CatalogProduct; sku?: MallSkuResponse; onBack: () => void; onSaved: () => Promise<void>; busyChanged: (busy: boolean) => void }) {
  const [code, setCode] = useState(sku?.skuCode ?? '');
  const [spec, setSpec] = useState(sku?.spec ?? '{}');
  const [materialId, setMaterialId] = useState(sku?.materialId ?? '');
  const [unit, setUnit] = useState(sku?.unit ?? '件');
  const [price, setPrice] = useState(String(sku?.price ?? ''));
  const [minimum, setMinimum] = useState(String(sku?.minOrderQty ?? 1));
  const [step, setStep] = useState(String(sku?.stepQty ?? 1));
  const [stock, setStock] = useState(sku?.stockQty == null ? '' : String(sku.stockQty));
  const [days, setDays] = useState(String(sku?.leadTimeDays ?? 7));
  const [tiers, setTiers] = useState((sku?.tierPrices ?? []).map(t => ({ minQty: String(t.minQty ?? ''), price: String(t.price ?? '') })));
  const [validation, setValidation] = useState('');
  const materials = useSupplierMallMaterials();
  const materialOptions = (materials.data?.data ?? []).filter(material => product.scope !== 'public'
    && Boolean(product.tenantId) && material.tenantId === product.tenantId);
  const mutation = useMutation({ mutationFn: async () => {
    const data: SaveMallSkuRequest = { skuCode: code.trim(), spec, materialId: materialId || undefined, unit: unit.trim(), price: Number(price), minOrderQty: Number(minimum), stepQty: Number(step), stockQty: stock === '' ? undefined : Number(stock), leadTimeDays: Number(days), tierPrices: tiers.map(t => ({ minQty: Number(t.minQty), price: Number(t.price) })) };
    const url = `${base}/${encodeURIComponent(product.id!)}/skus`;
    if (sku?.id) await axiosInstance.put(`${url}/${encodeURIComponent(sku.id)}`, data);
    else await axiosInstance.post(url, data);
    await onSaved();
  }, onMutate: () => busyChanged(true), onSettled: () => busyChanged(false) });
  const numeric = (label: string, value: string, change: (v: string) => void, min: string, optional = false, integer = false) => <label className="block text-sm font-bold">{label}<input className={input} type="number" required={!optional} min={min} step={integer ? '1' : '0.01'} value={value} disabled={mutation.isPending} onChange={e => change(e.target.value)} /></label>;
  return <form className="space-y-3" onSubmit={e => {
    e.preventDefault(); setValidation('');
    try { const value: unknown = JSON.parse(spec); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); }
    catch { setValidation('规格必须是有效的 JSON 对象。'); return; }
    if (!mutation.isPending) mutation.mutate();
  }}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm font-bold">规格编码<input className={input} value={code} disabled={mutation.isPending} onChange={e => setCode(e.target.value)} /></label>
      <label className="block text-sm font-bold">计量单位<input className={input} required value={unit} disabled={mutation.isPending} onChange={e => setUnit(e.target.value)} /></label>
      <label className="block text-sm font-bold">关联物料<select className={input} value={materialId} disabled={mutation.isPending} onChange={e => setMaterialId(e.target.value)}><option value="">不关联</option>{sku?.materialId && !materialOptions.some(m => m.materialId === sku.materialId) && <option value={sku.materialId} disabled={product.scope !== 'public'}>{sku.materialId}（原有关联）</option>}{materialOptions.map(m => <option key={`${m.tenantId}:${m.materialId}`} value={m.materialId}>{m.tenantName} · {m.name} ({m.code})</option>)}</select></label>
      {numeric('协议单价（元）', price, setPrice, '0.01')}{numeric('起订量', minimum, setMinimum, '0.01')}{numeric('递增步长', step, setStep, '0.01')}{numeric('库存（空为不限量）', stock, setStock, '0', true)}{numeric('交期天数', days, setDays, '0', false, true)}
    </div>
    <label className="block text-sm font-bold">规格键值 JSON<textarea className={`${input} min-h-20 font-mono`} value={spec} disabled={mutation.isPending} onChange={e => setSpec(e.target.value)} /></label>
    <div className="flex items-center justify-between"><h4 className="text-sm font-bold">阶梯价</h4><button type="button" className={button} disabled={mutation.isPending} onClick={() => setTiers([...tiers, { minQty: '', price: '' }])}><Plus size={14} />新增阶梯</button></div>
    {tiers.map((t, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      {numeric(`阶梯 ${i + 1} 数量`, t.minQty, value => setTiers(tiers.map((row, index) => index === i ? { ...row, minQty: value } : row)), '0.01')}
      {numeric(`阶梯 ${i + 1} 单价`, t.price, value => setTiers(tiers.map((row, index) => index === i ? { ...row, price: value } : row)), '0.01')}
      <button type="button" className={button} disabled={mutation.isPending} onClick={() => setTiers(tiers.filter((_, index) => index !== i))}>移除</button>
    </div>)}
    {(validation || mutation.isError) && <div role="alert"><FeedbackNotice tone="error" message={validation || errorText(mutation.error)} /></div>}
    <div className="flex justify-end gap-2"><button type="button" className={button} disabled={mutation.isPending} onClick={onBack}>取消</button><button type="submit" className={button} disabled={mutation.isPending}>{mutation.isPending ? '保存中…' : '保存规格'}</button></div>
  </form>;
}
